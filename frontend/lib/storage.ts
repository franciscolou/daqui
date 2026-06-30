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
