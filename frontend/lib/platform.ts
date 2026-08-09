import { Platform } from 'react-native';

/** Distingue o dispositivo do tamanho atual da viewport. Redimensionar uma
 * janela desktop não deve ativar comportamentos próprios de celular. */
export function isDesktopBrowser(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof navigator === 'undefined') return true;

  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  // iPadOS pode se identificar como macOS quando solicita a versão desktop.
  const ipadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return !mobileUserAgent && !ipadDesktopMode;
}
