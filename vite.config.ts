import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  // GitHub Pages de projeto serve em /<repo>/, não na raiz — sem isso os
  // assets buildados apontariam para /assets/... e dariam 404 no domínio
  // brenotorres44-blip.github.io/proDent/. Em dev (`npm run dev`) continua
  // servindo na raiz normalmente.
  base: process.env.VITE_GITHUB_PAGES ? '/proDent/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Separa o que quase nunca muda do código do produto: o navegador
        // reaproveita o cache dos vendors entre deploys.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['motion'],
        },
      },
    },
  },
});
