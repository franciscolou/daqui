import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { api } from './api';

// Enquanto o app está em foreground, mostra a notificação como alerta
// (por padrão o SDK não mostra nada se não configurar isso).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let cachedToken: string | null = null;

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId;
}

async function getDeviceToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  cachedToken = data;
  return data;
}

// Registra o token do dispositivo no backend. Chamado após login/restauração
// de sessão (ver lib/auth.tsx). Web e projectId ainda não configurado (ver
// app.json) fazem essa função falhar em silêncio — push é best-effort, nunca
// deve travar o resto do app.
export async function registerPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Padrão',
        importance: Notifications.AndroidImportance.MAX,
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status === 'undetermined') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const token = await getDeviceToken();
    if (token) await api.registerPushToken(token, Platform.OS as 'ios' | 'android');
  } catch {
    // Best-effort: projectId placeholder, permissão negada ou sem rede não
    // devem travar o app — só ficamos sem push até isso ser resolvido.
  }
}

// Desregistra o token do dispositivo no backend. Chamado no logout — não
// revoga a permissão do sistema, só para de mandar notificação pra essa
// sessão.
export async function unregisterPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const token = await getDeviceToken();
    if (token) await api.unregisterPushToken(token);
  } catch {
    // Best-effort: sem conexão no logout não deve travar o fluxo.
  }
}

// Navega pra tela certa quando o usuário toca numa notificação (app aberto
// a partir dela). Montado uma vez no RootLayout (app/_layout.tsx).
export function addNotificationTapListener(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as
      | { type?: string; userId?: number; groupId?: number }
      | undefined;
    if (data?.type === 'dm' && data.userId != null) {
      router.push(`/messages/${data.userId}` as any);
    } else if (data?.type === 'group' && data.groupId != null) {
      router.push(`/groups/${data.groupId}` as any);
    } else {
      router.push('/(tabs)/notifications' as any);
    }
  });
  return () => sub.remove();
}
