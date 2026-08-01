// Configuração por ambiente. A ordem é: `public/config.js` (arquivo servido
// junto com o build, editável sem recompilar — copie de config.example.js) →
// variáveis VITE_* do build → defaults de desenvolvimento.

declare global {
  interface Window {
    DAQUI_CONFIG?: { API_URL?: string; APP_URL?: string };
  }
}

const runtime = typeof window !== 'undefined' ? window.DAQUI_CONFIG ?? {} : {};

/** Base do ads-backend (login próprio do time de anúncios). */
export const DEFAULT_API_URL =
  runtime.API_URL ?? import.meta.env.VITE_API_URL ?? 'http://localhost:8001/api/v1';

/** App Daqui — onde vive o painel do próprio anunciante. */
export const APP_URL = (
  runtime.APP_URL ??
  import.meta.env.VITE_APP_URL ??
  'http://localhost:8081'
).replace(/\/$/, '');
