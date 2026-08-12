import { useEffect } from 'react';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { normalizeScreen, trackScreenView } from '../lib/analytics';
import { AuthProvider, useAuth } from '../lib/auth';
import { daquiGeoAdapter } from '../lib/daquiGeo';
import { GeoProvider } from '../lib/geoProvider';
import { I18nProvider } from '../lib/i18n';
import { addNotificationTapListener } from '../lib/push';
import { RealtimeProvider } from '../lib/realtime';
import { ScrollToTopProvider } from '../lib/scrollToTop';
import { ThemeProvider, useThemeMode } from '../lib/theme';
import '../lib/globalStyles';
import '../constants/BrandFont'; // preview: aplica a fonte-marca como fonte padrão de todo Text

function ThemedStatusBar() {
  const { mode } = useThemeMode();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

// Navega pra conversa/grupo certo quando o usuário toca numa push notification.
function PushNotificationTapHandler() {
  useEffect(() => addNotificationTapListener(), []);
  return null;
}

// Reporta cada troca de rota pro tracker de uso (ver lib/analytics.ts) — só
// enquanto autenticado, telas de login/cadastro ficam de fora de propósito.
function AnalyticsRouteTracker() {
  const pathname = usePathname();
  const { user } = useAuth();
  useEffect(() => {
    if (user) trackScreenView(normalizeScreen(pathname));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user?.id]);
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <RealtimeProvider>
            <GeoProvider adapter={daquiGeoAdapter}>
              <ScrollToTopProvider>
                <ThemedStatusBar />
                <PushNotificationTapHandler />
                <AnalyticsRouteTracker />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="user/[username]" />
                  <Stack.Screen name="[username]/post/[publicId]" />
                  <Stack.Screen name="ad/[id]" />
                  <Stack.Screen name="poll/[id]" />
                  <Stack.Screen name="messages/[username]/index" />
                  <Stack.Screen name="messages/[username]/info" />
                  <Stack.Screen name="messages/[username]/media" />
                  <Stack.Screen name="groups/index" />
                  <Stack.Screen name="groups/new" />
                  <Stack.Screen name="groups/[publicId]/index" />
                  <Stack.Screen name="groups/[publicId]/info" />
                  <Stack.Screen name="groups/[publicId]/media" />
                  <Stack.Screen name="neighbors/index" />
                  <Stack.Screen name="rate/index" />
                  <Stack.Screen name="help/index" />
                  <Stack.Screen name="forward/[postId]" />
                  <Stack.Screen name="quote/[postId]" />
                  <Stack.Screen name="advertise/index" />
                  <Stack.Screen name="advertise/customize" />
                  <Stack.Screen name="advertise/checkout" />
                  <Stack.Screen name="advertise/checkout/content" />
                  <Stack.Screen name="advertise/checkout/success" />
                  <Stack.Screen name="advertise/dashboard/index" />
                  <Stack.Screen name="advertise/dashboard/edit/[token]" />
                  <Stack.Screen name="advertise/dashboard/[token]" />
                  <Stack.Screen name="settings" />
                  <Stack.Screen name="legal/terms" />
                  <Stack.Screen name="legal/privacy" />
                </Stack>
              </ScrollToTopProvider>
            </GeoProvider>
          </RealtimeProvider>
        </AuthProvider>
      </ThemeProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
