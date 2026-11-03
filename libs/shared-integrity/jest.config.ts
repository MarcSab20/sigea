// libs/shared-integrity/jest.config.ts
//
// Ce fichier MANQUAIT : `project.json` déclarait une cible `test` pointant vers
// lui, mais il n'a jamais été créé. La bibliothèque qui porte les empreintes et
// les instantanés — c'est-à-dire tout ce qui donne au système sa valeur
// probante — n'était donc couverte par aucun test exécutable.
//
// Calqué sur celui de shared-types : même préréglage, même transformateur SWC.

export default {
  displayName: 'shared-integrity',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: { '^.+\\.[tj]s$': ['@swc/jest', { jsc: { target: 'es2021' } }] },
  coverageDirectory: '../../coverage/libs/shared-integrity',
};