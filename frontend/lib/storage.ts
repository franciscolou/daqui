import { Platform } from 'react-native';

/**
 * Armazenamento simples de chave/valor para o token de autenticação.
 * Na web usa localStorage (persiste entre recargas). Em nativo, sem uma
 * dependência de storage instalada, cai para memória — o token dura
 * enquanto o app estiver aberto. Suficiente para o fluxo de desenvolvimento.
 */
const memory = new Map<string, string>();

const hasLocalStorage =
  Platform.OS === 'web' &&
  typeof globalThis !== 'undefined' &&
  typeof globalThis.localStorage !== 'undefined';

export async function getItem(key: string): Promise<string | null> {
  if (hasLocalStorage) return globalThis.localStorage.getItem(key);
  return memory.get(key) ?? null;
}

export async function setItem(key: string, value: string): Promise<void> {
  if (hasLocalStorage) {
    globalThis.localStorage.setItem(key, value);
    return;
  }
  memory.set(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (hasLocalStorage) {
    globalThis.localStorage.removeItem(key);
    return;
  }
  memory.delete(key);
}

const AD_VIEWER_ID_KEY = 'daqui.adViewerId';

function randomUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Identificador anônimo e pseudônimo do dispositivo, usado só pelo
 * `ads-backend` (caps de impressão por usuário) — não é o id real do
 * usuário no Daqui, mantendo os dois backends desacoplados.
 */
export async function getOrCreateAdViewerId(): Promise<string> {
  const existing = await getItem(AD_VIEWER_ID_KEY);
  if (existing) return existing;
  const id = randomUuidV4();
  await setItem(AD_VIEWER_ID_KEY, id);
  return id;
}
