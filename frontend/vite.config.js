import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = 'http://localhost:8080';
const stripBase = (path) => path.replace(/^\/myblog/, '');

export default defineConfig({
  base: '/myblog/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/myblog/api': { target: backend, rewrite: stripBase },
      '/myblog/login': { target: backend, rewrite: stripBase },
      '/myblog/logout': { target: backend, rewrite: stripBase },
      '/myblog/register': { target: backend, rewrite: stripBase },
    },
  },
});
