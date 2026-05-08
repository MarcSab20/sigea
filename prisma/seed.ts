import { PrismaClient, RoleUtilisateur } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seed SIGEA en cours...');

  // Bases aériennes
  const baseYaounde = await prisma.base.upsert({
    where: { code_base: 'BA101' },
    update: {},
    create: { code_base: 'BA101', nom: 'Base Aérienne 101 Yaoundé', region: 'Centre' },
  });

  const baseDouala = await prisma.base.upsert({
    where: { code_base: 'BA102' },
    update: {},
    create: { code_base: 'BA102', nom: 'Base Aérienne 102 Douala', region: 'Littoral' },
  });

  // Aéronef de test
  await prisma.aeronef.upsert({
    where: { immatriculation: 'TJ-AAF' },
    update: {},
    create: { immatriculation: 'TJ-AAF', type: 'C-130', capacite_places: 92, capacite_cargo_kg: 19000 },
  });

  // Utilisateurs de test (MOT DE PASSE À CHANGER EN PROD)
  const password = await bcrypt.hash('ChangeMe@2025!', 12);

  const users = [
    { login: 'chef.escale.yaounde', role: RoleUtilisateur.chef_escale, base_id: baseYaounde.id, nom: 'Mbarga', prenom: 'Jean', grade: 'Adjudant' },
    { login: 'comeso.yaounde', role: RoleUtilisateur.comeso, base_id: baseYaounde.id, nom: 'Fouda', prenom: 'Paul', grade: 'Lieutenant' },
    { login: 'comgmo.yaounde', role: RoleUtilisateur.comgmo, base_id: baseYaounde.id, nom: 'Ateba', prenom: 'Marie', grade: 'Capitaine' },
    { login: 'combase.yaounde', role: RoleUtilisateur.combase, base_id: baseYaounde.id, nom: 'Nkomo', prenom: 'Alain', grade: 'Colonel' },
    { login: 'cemaa', role: RoleUtilisateur.cemaa, base_id: baseYaounde.id, nom: 'CEMAA', prenom: 'Général', grade: 'Général de Corps d\'Armée Aérienne' },
    { login: 'chef.escale.douala', role: RoleUtilisateur.chef_escale, base_id: baseDouala.id, nom: 'Bello', prenom: 'Hassan', grade: 'Adjudant-Chef' },
  ];

  for (const u of users) {
    await prisma.utilisateur.upsert({
      where: { login: u.login },
      update: {},
      create: { ...u, password_hash: password },
    });
  }

  console.log('✅ Seed terminé — utilisateurs créés (OTP non configuré — à faire via /auth/setup-otp)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
