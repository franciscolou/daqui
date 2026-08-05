import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, '../frontend');

// Alguns pacotes do ecossistema React Native publicam JSX dentro de arquivos
// `.js`, e o esbuild do Vite não liga o loader JSX pra essa extensão sozinho.
const rnJsxInJs: Plugin = {
  name: 'rn-jsx-in-js',
  enforce: 'pre',
  async transform(code, id) {
    if (!id.includes('node_modules')) return null;
    if (!/\.js$/.test(id.split('?')[0])) return null;
    if (!/(@expo\/vector-icons|react-native-|@react-native)/.test(id)) return null;
    const out = await transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
    return { code: out.code, map: out.map as unknown as null };
  },
};

export default defineConfig({
  plugins: [rnJsxInJs, react()],
  resolve: {
    // `.web.tsx` antes de `.tsx` é o que faz o app pegar as versões web dos
    // componentes compartilhados do Daqui (LeafletMap.web, location.web...),
    // exatamente como o Metro faz no `expo start --web`.
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: [
      // Os componentes de local vêm do app Daqui, escritos em React Native —
      // react-native-web os renderiza como DOM comum aqui.
      { find: /^react-native$/, replacement: 'react-native-web' },
      // Ionicons sem o runtime do Expo (ver src/daqui/vectorIcons.tsx).
      { find: /^@expo\/vector-icons$/, replacement: path.resolve(here, 'src/daqui/vectorIcons.tsx') },
      { find: '@daqui', replacement: frontend },
    ],
    dedupe: ['react', 'react-dom', 'react-native-web'],
  },
  optimizeDeps: {
    esbuildOptions: { loader: { '.js': 'jsx' }, jsx: 'automatic' },
  },
  // react-native-web e os componentes compartilhados esperam esses globais do
  // bundler do RN.
  define: { global: 'globalThis', __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production') },
  server: { port: 8091, host: true },
  preview: { port: 8091, host: true },
});
