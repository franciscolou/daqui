import { Platform } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';

// router.back() joga "GO_BACK not handled by any navigator" quando a tela é
// aberta direto (deep link / refresh da página no web) e o histórico do
// React Navigation está vazio — mesmo que o navegador tenha pra onde voltar
// (um refresh não apaga o window.history, só o estado em memória do app).
// No web, nesse caso preferimos o "voltar" nativo do navegador — ele
// resolve pra página real anterior, e o expo-router resincroniza a rota
// via popstate. Só cai no fallback fixo quando não há nem isso (aba nova,
// link direto).
export function goBack(fallback: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history.length > 1) {
    window.history.back();
    return;
  }
  router.replace(fallback);
}
