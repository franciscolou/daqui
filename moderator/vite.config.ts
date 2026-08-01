import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Painel de moderação: React puro (sem os componentes React Native do app —
// aqui não há seleção de local), então o build é o padrão do Vite.
export default defineConfig({
  plugins: [react()],
  server: { port: 8090, host: true },
  preview: { port: 8090, host: true },
});
