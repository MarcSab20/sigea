import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1d4ed8',
        cemaa:   '#7c3aed',
      },
    },
  },
  plugins: [],
} satisfies Config;
