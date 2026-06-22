// Script à exécuter : npx ts-node --project tsconfig.base.json prisma/seed-bases-aeronefs.ts
// Crée les bases FAC et aéronefs si absents

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASES = [
  { code_base: 'BA101', nom: 'Base Aérienne 101 Yaoundé',    region: 'Centre' },
  { code_base: 'BA102', nom: 'Base Aérienne 102 Bertoua',     region: 'Est' },
  { code_base: 'BA201', nom: 'Base Aérienne 201 Douala',     region: 'Littoral' },
  { code_base: 'BA301', nom: 'Base Aérienne 301 Garoua',     region: 'Nord' },
  { code_base: 'BA302', nom: 'Base Aérienne 302 Ngaoundéré', region: 'Adamaoua' },
  { code_base: 'BA401', nom: 'Base Aérienne 401 Maroua',  region: 'Extrême-Nord' },
  { code_base: 'BA501', nom: 'Base Aérienne 501 Bamenda',    region: 'Nord-Ouest' },
];

const AERONEFS = [
  { immatriculation: 'TJ-AAF', type: 'C-130 Hercule', capacite_places: 92,  capacite_cargo_kg: 19000 },
  { immatriculation: 'TJ-ABB', type: 'Agusta',        capacite_places: 12,  capacite_cargo_kg: 1500  },
  { immatriculation: 'TJ-ACC', type: 'CESSNA 2B',     capacite_places: 8,   capacite_cargo_kg: 800   },
  { immatriculation: 'TJ-AZZ', type: 'Z9',            capacite_places: 10,  capacite_cargo_kg: 1200  },
  { immatriculation: 'TJ-AMI', type: 'MI-17',         capacite_places: 24,  capacite_cargo_kg: 4000  },
];

async function main(): Promise<void> {
  console.log('🌱 Seed bases et aéronefs FAC…');

  for (const b of BASES) {
    await prisma.base.upsert({
      where: { code_base: b.code_base },
      update: { nom: b.nom, region: b.region },
      create: b,
    });
    console.log(`  ✓ Base ${b.code_base}`);
  }

  for (const a of AERONEFS) {
    await prisma.aeronef.upsert({
      where: { immatriculation: a.immatriculation },
      update: { type: a.type, capacite_places: a.capacite_places, capacite_cargo_kg: a.capacite_cargo_kg },
      create: { ...a, actif: true },
    });
    console.log(`  ✓ Aéronef ${a.immatriculation} — ${a.type}`);
  }

  console.log('✅ Seed terminé');
}

main().catch(console.error).finally(() => prisma.$disconnect());