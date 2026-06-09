// prisma/seed.ts — SEED RÉCONCILIÉ
// Corrige le bug de cohérence des ID de base :
//  - id de base = code_base, en MAJUSCULES, source unique de vérité
//  - mapping ville/région UNIQUE (aligné sur le frontend et seed-bases-aeronefs.ts)
//  - suppression de l'ancien bloc de "migration d'ID" fragile (cause racine du bug)
//  - mot de passe de seed lu depuis SEED_PASSWORD (fallback dev explicitement signalé)
//
// IMPORTANT : les désignations/implantations ci-dessous reprennent celles déjà
// présentes et cohérentes dans votre frontend (BASES_FAC) et dans
// prisma/seed-bases-aeronefs.ts. À FAIRE CONFIRMER par la FAC pour la production —
// je ne les invente pas, je les aligne sur votre propre source interne.

import { config } from 'dotenv';
config();

import { PrismaClient, RoleUtilisateur } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Source unique : id === code_base (MAJUSCULES). Toute la chaîne (tokens, guards,
// front) doit utiliser cette casse. Voir note casse dans INTEGRATION.md.
const BASES = [
  { id: 'BA101', code_base: 'BA101', nom: 'Base Aérienne 101 Yaoundé',    region: 'Centre' },
  { id: 'BA102', code_base: 'BA102', nom: 'Base Aérienne 102 Bertoua',     region: 'Est' },
  { id: 'BA201', code_base: 'BA201', nom: 'Base Aérienne 201 Douala',     region: 'Littoral' },
  { id: 'BA301', code_base: 'BA301', nom: 'Base Aérienne 301 Garoua',     region: 'Nord' },
  { id: 'BA302', code_base: 'BA302', nom: 'Base Aérienne 302 Ngaoundéré', region: 'Adamaoua' },
  { id: 'BA401', code_base: 'BA401', nom: 'Base Aérienne 401 Maroua',  region: 'Extrême-Nord' },
  { id: 'BA501', code_base: 'BA501', nom: 'Base Aérienne 501 Bamenda',    region: 'Nord-Ouest' },
];

const AERONEFS = [
  { immatriculation: 'TJ-AAF', type: 'C-130 Hercule', capacite_places: 92, capacite_cargo_kg: 19000 },
  { immatriculation: 'TJ-ABB', type: 'Agusta',        capacite_places: 12, capacite_cargo_kg: 1500  },
  { immatriculation: 'TJ-ACC', type: 'CESSNA 2B',     capacite_places: 8,  capacite_cargo_kg: 800   },
  { immatriculation: 'TJ-AZZ', type: 'Z9',            capacite_places: 10, capacite_cargo_kg: 1200  },
  { immatriculation: 'TJ-AMI', type: 'MI-17',         capacite_places: 24, capacite_cargo_kg: 4000  },
];

async function main(): Promise<void> {
  console.log('🌱 Seed SIGEA (réconcilié)…');

  // 1. Bases — upsert idempotent par id déterministe (= code_base majuscules).
  for (const b of BASES) {
    await prisma.base.upsert({
      where: { id: b.id },
      update: { code_base: b.code_base, nom: b.nom, region: b.region },
      create: b,
    });
    console.log(`  ✓ Base ${b.code_base}`);
  }

  // 2. Aéronefs.
  for (const a of AERONEFS) {
    await prisma.aeronef.upsert({
      where: { immatriculation: a.immatriculation },
      update: { type: a.type, capacite_places: a.capacite_places, capacite_cargo_kg: a.capacite_cargo_kg },
      create: { ...a, actif: true },
    });
    console.log(`  ✓ Aéronef ${a.immatriculation} — ${a.type}`);
  }

  // 3. Utilisateurs de test — base_id en MAJUSCULES, cohérent avec les bases.
  const rawPwd = process.env.SEED_PASSWORD;
  if (!rawPwd) {
    console.warn('  ⚠ SEED_PASSWORD non défini — usage d\'un mot de passe DEV par défaut.');
    console.warn('  ⚠ NE PAS UTILISER EN PRODUCTION. Définir SEED_PASSWORD avant tout déploiement.');
  }
  const password = await bcrypt.hash(rawPwd ?? 'ChangeMe@2025!', 12);

  const users = [
    { login: 'admin.sigea',         role: RoleUtilisateur.admin,       base_id: 'BA101', nom: 'Admin',  prenom: 'Système', grade: 'Colonel' },
    { login: 'chef.escale.yaounde', role: RoleUtilisateur.chef_escale, base_id: 'BA101', nom: 'Mbarga', prenom: 'Jean',    grade: 'Adjudant' },
    { login: 'comeso.yaounde',      role: RoleUtilisateur.comeso,      base_id: 'BA101', nom: 'Fouda',  prenom: 'Paul',    grade: 'Lieutenant' },
    { login: 'comgmo.yaounde',      role: RoleUtilisateur.comgmo,      base_id: 'BA101', nom: 'Ateba',  prenom: 'Marie',   grade: 'Capitaine' },
    { login: 'combase.yaounde',     role: RoleUtilisateur.combase,     base_id: 'BA101', nom: 'Nkomo',  prenom: 'Alain',   grade: 'Colonel' },
    { login: 'cemaa',               role: RoleUtilisateur.cemaa,       base_id: 'BA101', nom: 'CEMAA',  prenom: 'Général', grade: 'Général de Corps d\'Armée Aérienne' },
    { login: 'chef.escale.douala',  role: RoleUtilisateur.chef_escale, base_id: 'BA101', nom: 'Bello',  prenom: 'Hassan',  grade: 'Adjudant-Chef' },
  ];

  for (const u of users) {
    await prisma.utilisateur.upsert({
      where: { login: u.login },
      update: { base_id: u.base_id, role: u.role },
      create: { ...u, password_hash: password },
    });
  }

  console.log('✅ Seed terminé — ID de base normalisés (MAJUSCULES), mapping unique.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
