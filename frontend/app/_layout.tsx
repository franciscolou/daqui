import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { AuthProvider } from '../lib/auth';
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
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="user/[id]" />
                  <Stack.Screen name="post/[id]" />
                  <Stack.Screen name="ad/[id]" />
                  <Stack.Screen name="poll/[id]" />
                  <Stack.Screen name="messages/[id]/index" />
                  <Stack.Screen name="messages/[id]/info" />
                  <Stack.Screen name="groups/index" />
                  <Stack.Screen name="groups/new" />
                  <Stack.Screen name="groups/[id]/index" />
                  <Stack.Screen name="groups/[id]/info" />
                  <Stack.Screen name="neighbors/index" />
                  <Stack.Screen name="rate/index" />
                  <Stack.Screen name="help/index" />
                  <Stack.Screen name="forward/[postId]" />
                  <Stack.Screen name="quote/[postId]" />
                  <Stack.Screen name="advertise/index" />
                  <Stack.Screen name="advertise/customize" />
                  <Stack.Screen name="advertise/checkout" />
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
