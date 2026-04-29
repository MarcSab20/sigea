import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@sigea/shared-types': path.resolve(__dirname, '../../libs/shared-types/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/notifications': { target: 'ws://localhost:3000', ws: true },
    },
  },
  build: { outDir: 'dist' },
});
