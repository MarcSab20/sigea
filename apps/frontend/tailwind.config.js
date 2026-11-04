// apps/frontend/tailwind.config.js
//
// En JavaScript et non en TypeScript : chargé par PostCSS, hors de la chaîne
// Vite, donc sans transpilation disponible.
//
// `content` est relatif au répertoire d'exécution. Les deux chemins couvrent
// les deux cas : `npx vite` depuis apps/frontend, et `nx build frontend`
// depuis la racine du dépôt. Un seul des deux correspondra, l'autre est sans
// effet — c'est moins fragile que de dépendre du répertoire courant.

module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    './apps/frontend/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1d4ed8',
        cemaa:   '#7c3aed',
      },
    },
  },
  plugins: [],
};