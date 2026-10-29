// prisma/seed.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI CHANGE
// ═══════════════════════════════════════════════════════════════════════════
// • Chaque base porte sa RMIA. La colonne est obligatoire : sans elle, aucun
//   officier de la chaîne régionale ne voit quoi que ce soit.
// • Les comptes chef_escale et comeso disparaissent — les rôles n'existent plus.
// • La chaîne RMIA est créée pour les cinq régions : COMRMIA, ADJ_AIR,
//   SEC_ADJ_AIR. Sans elle, le circuit s'arrête à la première étape.
// • Un SCOPS est créé. Sans lui, aucun vol ne peut être diffusé, et le système
//   entier reste bloqué au stade de la planification.
//
// `prisma/seed-bases-aeronefs.ts` est SUPPRIMÉ : il faisait double emploi avec
// ce fichier et contenait un défaut — il écrivait `b.numero` alors que son
// tableau de bases ne portait pas ce champ, pourtant obligatoire. Il échouait
// donc à chaque exécution.
//
// Idempotent : exécutable autant de fois que nécessaire.

import { config } from 'dotenv';
config();

import { PrismaClient, RoleUtilisateur, Rmia } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Bases aériennes.
 *
 * `id === code_base`, en majuscules : source unique de vérité, alignée sur les
 * jetons, les gardes et le frontend.
 *
 * La RMIA est écrite ICI plutôt que dérivée de `region` à l'exécution, pour que
 * le seed n'ait aucune dépendance applicative. La cohérence entre les deux
 * colonnes est vérifiée plus bas, et le service la revérifie à chaque écriture
 * via `rmiaDeRegionStrict`.
 *
 * Désignations et implantations reprises de votre référentiel existant. Je ne
 * les invente pas, je les reconduis — elles restent à faire confirmer par la
 * FAC avant mise en service.
 */
const BASES = [
  { id: 'BA101', code_base: 'BA101', numero: '101', nom: 'Base Aérienne 101 Yaoundé',    region: 'Centre',       rmia: Rmia.RMIA_1 },
  { id: 'BA102', code_base: 'BA102', numero: '102', nom: 'Base Aérienne 102 Bertoua',    region: 'Est',          rmia: Rmia.RMIA_1 },
  { id: 'BA201', code_base: 'BA201', numero: '201', nom: 'Base Aérienne 201 Douala',     region: 'Littoral',     rmia: Rmia.RMIA_2 },
  { id: 'BA301', code_base: 'BA301', numero: '301', nom: 'Base Aérienne 301 Garoua',     region: 'Nord',         rmia: Rmia.RMIA_3 },
  { id: 'BA302', code_base: 'BA302', numero: '302', nom: 'Base Aérienne 302 Ngaoundéré', region: 'Adamaoua',     rmia: Rmia.RMIA_3 },
  { id: 'BA401', code_base: 'BA401', numero: '401', nom: 'Base Aérienne 401 Maroua',     region: 'Extrême-Nord', rmia: Rmia.RMIA_4 },
  { id: 'BA501', code_base: 'BA501', numero: '501', nom: 'Base Aérienne 501 Bamenda',    region: 'Nord-Ouest',   rmia: Rmia.RMIA_5 },
];

/** Découpage de référence, dupliqué ici pour contrôler le tableau ci-dessus. */
const REGIONS_PAR_RMIA: Record<Rmia, string[]> = {
  [Rmia.RMIA_1]: ['centre', 'sud', 'est'],
  [Rmia.RMIA_2]: ['littoral', 'sud-ouest'],
  [Rmia.RMIA_3]: ['nord', 'adamaoua'],
  [Rmia.RMIA_4]: ['extreme-nord'],
  [Rmia.RMIA_5]: ['ouest', 'nord-ouest'],
};

function normaliser(region: string): string {
  return region.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[\s\u2010-\u2015_]+/g, '-');
}

const AERONEFS = [
  { immatriculation: 'TJ-AAF', type: 'C-130 Hercule', capacite_places: 92, capacite_cargo_kg: 19000 },
  { immatriculation: 'TJ-ABB', type: 'Agusta',        capacite_places: 12, capacite_cargo_kg: 1500  },
  { immatriculation: 'TJ-ACC', type: 'CESSNA 2B',     capacite_places: 8,  capacite_cargo_kg: 800   },
  { immatriculation: 'TJ-AZZ', type: 'Z9',            capacite_places: 10, capacite_cargo_kg: 1200  },
  { immatriculation: 'TJ-AMI', type: 'MI-17',         capacite_places: 24, capacite_cargo_kg: 4000  },
];

/** Base d'implantation de l'état-major de chaque RMIA. */
const SIEGE_RMIA: Record<Rmia, string> = {
  [Rmia.RMIA_1]: 'BA101',
  [Rmia.RMIA_2]: 'BA201',
  [Rmia.RMIA_3]: 'BA301',
  [Rmia.RMIA_4]: 'BA401',
  [Rmia.RMIA_5]: 'BA501',
};

const VILLE_RMIA: Record<Rmia, string> = {
  [Rmia.RMIA_1]: 'yaounde',
  [Rmia.RMIA_2]: 'douala',
  [Rmia.RMIA_3]: 'garoua',
  [Rmia.RMIA_4]: 'maroua',
  [Rmia.RMIA_5]: 'bamenda',
};

interface CompteSeed {
  login: string;
  role: RoleUtilisateur;
  base_id: string;
  rmia?: Rmia | null;
  nom: string;
  prenom: string;
  grade: string;
  telephone?: string;
}

/**
 * Noms et prénoms fictifs, uniquement destinés aux environnements de
 * développement et de recette. Ils ne désignent personne.
 */
function comptesRmia(rmia: Rmia): CompteSeed[] {
  const ville = VILLE_RMIA[rmia];
  const base = SIEGE_RMIA[rmia];
  const n = rmia.slice(-1);
  return [
    {
      login: `comrmia.${ville}`, role: RoleUtilisateur.comrmia, base_id: base, rmia,
      nom: `Commandant${n}`, prenom: 'Région', grade: 'Général de Brigade',
    },
    {
      login: `adjair.${ville}`, role: RoleUtilisateur.adj_air, base_id: base, rmia,
      nom: `Adjoint${n}`, prenom: 'Air', grade: 'Colonel',
    },
    {
      login: `secadjair.${ville}`, role: RoleUtilisateur.sec_adj_air, base_id: base, rmia,
      nom: `Secretaire${n}`, prenom: 'Adjoint', grade: 'Adjudant-Chef',
    },
  ];
}

const COMPTES_CENTRAUX: CompteSeed[] = [
  {
    login: 'admin.sigea', role: RoleUtilisateur.admin, base_id: 'BA101', rmia: null,
    nom: 'Admin', prenom: 'Système', grade: 'Colonel',
  },
  {
    // Sans ce compte, aucun vol ne peut être diffusé : tout le circuit reste
    // bloqué au stade de la planification.
    login: 'scops', role: RoleUtilisateur.scops, base_id: 'BA101', rmia: null,
    nom: 'Sous-Chef', prenom: 'Opérations', grade: 'Colonel',
  },
  {
    login: 'cemaa', role: RoleUtilisateur.cemaa, base_id: 'BA101', rmia: null,
    nom: 'CEMAA', prenom: 'État-Major', grade: "Général de Corps d'Armée Aérienne",
  },
  {
    login: 'mage', role: RoleUtilisateur.mage, base_id: 'BA101', rmia: null,
    nom: 'MAGE', prenom: 'Autorité', grade: 'Général de Division',
  },
];

/** Chaîne de la base de décollage, et commandants de bord. */
const COMPTES_BASE: CompteSeed[] = [
  {
    login: 'combase.yaounde', role: RoleUtilisateur.combase, base_id: 'BA101', rmia: null,
    nom: 'Nkomo', prenom: 'Alain', grade: 'Colonel',
  },
  {
    login: 'comsecbase.yaounde', role: RoleUtilisateur.comsecbase, base_id: 'BA101', rmia: null,
    nom: 'Ateba', prenom: 'Marie', grade: 'Lieutenant-Colonel',
  },
  {
    login: 'comgmo.yaounde', role: RoleUtilisateur.comgmo, base_id: 'BA101', rmia: null,
    nom: 'Fouda', prenom: 'Paul', grade: 'Commandant',
  },
  {
    login: 'comea.yaounde', role: RoleUtilisateur.comea, base_id: 'BA101', rmia: null,
    nom: 'Essomba', prenom: 'Yves', grade: 'Commandant',
  },
  {
    login: 'combord.kamga', role: RoleUtilisateur.combord, base_id: 'BA101', rmia: null,
    nom: 'Kamga', prenom: 'Éric', grade: 'Commandant',
  },
  {
    login: 'combord.bello', role: RoleUtilisateur.combord, base_id: 'BA201', rmia: null,
    nom: 'Bello', prenom: 'Hassan', grade: 'Capitaine',
  },
  {
    login: 'combase.douala', role: RoleUtilisateur.combase, base_id: 'BA201', rmia: null,
    nom: 'Ngando', prenom: 'Serge', grade: 'Colonel',
  },
  {
    login: 'combase.garoua', role: RoleUtilisateur.combase, base_id: 'BA301', rmia: null,
    nom: 'Oumarou', prenom: 'Idrissou', grade: 'Colonel',
  },
];

async function main(): Promise<void> {
  console.log('Seed SIGEA — modèle « directive ministérielle »');

  // ── Contrôle de cohérence région ⇄ RMIA, AVANT toute écriture ──
  //
  // Une base mal rattachée ne produit pas d'erreur visible : elle rend
  // simplement ses listes invisibles de la région qui devrait les traiter.
  // Le défaut se découvrirait le jour d'un vol, pas au seed.
  for (const b of BASES) {
    const attendue = (Object.keys(REGIONS_PAR_RMIA) as Rmia[]).find((r) =>
      REGIONS_PAR_RMIA[r].includes(normaliser(b.region)),
    );
    if (attendue !== b.rmia) {
      throw new Error(
        `Base ${b.code_base} : région « ${b.region} » relève de ${attendue ?? 'aucune RMIA'}, ` +
          `mais le seed déclare ${b.rmia}. Corrigez avant d'exécuter.`,
      );
    }
  }

  for (const b of BASES) {
    await prisma.base.upsert({
      where: { id: b.id },
      update: { code_base: b.code_base, numero: b.numero, nom: b.nom, region: b.region, rmia: b.rmia },
      create: b,
    });
    console.log(`  Base ${b.code_base} — ${b.region} (${b.rmia})`);
  }

  for (const a of AERONEFS) {
    await prisma.aeronef.upsert({
      where: { immatriculation: a.immatriculation },
      update: {
        type: a.type,
        capacite_places: a.capacite_places,
        capacite_cargo_kg: a.capacite_cargo_kg,
      },
      create: { ...a, actif: true },
    });
    console.log(`  Aéronef ${a.immatriculation} — ${a.type}`);
  }

  const motDePasseBrut = process.env.SEED_PASSWORD;
  if (!motDePasseBrut) {
    console.warn('  SEED_PASSWORD non défini — mot de passe de développement par défaut.');
    console.warn('  NE PAS UTILISER EN PRODUCTION. Définissez SEED_PASSWORD avant tout déploiement.');
  }
  const password_hash = await bcrypt.hash(motDePasseBrut ?? 'ChangeMe@2025!', 12);

  const comptes: CompteSeed[] = [
    ...COMPTES_CENTRAUX,
    ...COMPTES_BASE,
    ...(Object.keys(SIEGE_RMIA) as Rmia[]).flatMap(comptesRmia),
  ];

  for (const c of comptes) {
    await prisma.utilisateur.upsert({
      where: { login: c.login },
      // `rmia` figure dans l'update : un compte créé avant l'introduction du
      // cloisonnement régional doit être rattaché au prochain passage, sans
      // quoi son titulaire resterait devant un écran vide sans comprendre.
      update: { base_id: c.base_id, role: c.role, rmia: c.rmia ?? null, actif: true },
      create: {
        login: c.login, role: c.role, base_id: c.base_id, rmia: c.rmia ?? null,
        nom: c.nom, prenom: c.prenom, grade: c.grade,
        telephone: c.telephone ?? null,
        password_hash,
      },
    });
  }
  console.log(`  ${comptes.length} comptes créés ou mis à jour`);

  // ── Contrôle final ──
  //
  // Trois conditions sans lesquelles le circuit ne peut pas s'exécuter de bout
  // en bout. Les vérifier ici évite de les découvrir en cours de démonstration.
  const scops = await prisma.utilisateur.count({ where: { role: RoleUtilisateur.scops, actif: true } });
  const combord = await prisma.utilisateur.count({ where: { role: RoleUtilisateur.combord, actif: true } });
  const sansRmia = await prisma.utilisateur.count({
    where: {
      rmia: null,
      role: { in: [RoleUtilisateur.comrmia, RoleUtilisateur.adj_air, RoleUtilisateur.sec_adj_air] },
    },
  });

  if (!scops)   console.warn('  AVERTISSEMENT : aucun SCOPS actif — aucun vol ne pourra être diffusé.');
  if (!combord) console.warn('  AVERTISSEMENT : aucun commandant de bord actif — aucun manifeste ne pourra être visé.');
  if (sansRmia) console.warn(`  AVERTISSEMENT : ${sansRmia} compte(s) de la chaîne RMIA sans région rattachée.`);

  console.log('Seed terminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());