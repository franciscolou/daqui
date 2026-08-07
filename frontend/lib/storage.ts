import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Armazenamento simples de chave/valor para o token de autenticação.
 * Na web usa localStorage; em Android/iOS usa AsyncStorage. Ambos persistem
 * entre reinicializações do app.
 */
const hasLocalStorage =
  Platform.OS === 'web' &&
  typeof globalThis !== 'undefined' &&
  typeof globalThis.localStorage !== 'undefined';

export async function getItem(key: string): Promise<string | null> {
  if (hasLocalStorage) return globalThis.localStorage.getItem(key);
  return AsyncStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (hasLocalStorage) {
    globalThis.localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (hasLocalStorage) {
    globalThis.localStorage.removeItem(key);
    return;
  }
  await AsyncStorage.removeItem(key);
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

const AD_ADVERTISER_INFO_KEY = 'daqui.adAdvertiserInfo';

export interface SavedAdvertiserInfo {
  type: 'individual' | 'company';
  name: string;
  document: string;
  email: string;
  phone: string;
}

/**
 * Dados de Pessoa Física/Jurídica lembrados no dispositivo para
 * pré-preencher o formulário de novas campanhas de anúncio — opt-in via
 * checkbox em `advertise/checkout.tsx`, nunca enviado a nenhum backend.
 */
export async function getSavedAdvertiserInfo(): Promise<SavedAdvertiserInfo | null> {
  const raw = await getItem(AD_ADVERTISER_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedAdvertiserInfo;
  } catch {
    return null;
  }
}

export async function saveAdvertiserInfo(info: SavedAdvertiserInfo): Promise<void> {
  await setItem(AD_ADVERTISER_INFO_KEY, JSON.stringify(info));
}

export async function clearSavedAdvertiserInfo(): Promise<void> {
  await removeItem(AD_ADVERTISER_INFO_KEY);
}
