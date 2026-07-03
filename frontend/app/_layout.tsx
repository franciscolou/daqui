import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { AuthProvider } from '../lib/auth';
import { ThemeProvider, useThemeMode } from '../lib/theme';
import '../lib/globalStyles';
import '../constants/BrandFont'; // preview: aplica a fonte-marca como fonte padrão de todo Text

function ThemedStatusBar() {
  const { mode } = useThemeMode();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <AuthProvider>
          <ThemedStatusBar />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="user/[id]" />
            <Stack.Screen name="post/[id]" />
            <Stack.Screen name="messages/[id]" />
            <Stack.Screen name="groups/index" />
            <Stack.Screen name="groups/new" />
            <Stack.Screen name="groups/[id]/index" />
            <Stack.Screen name="groups/[id]/info" />
            <Stack.Screen name="forward/[postId]" />
            <Stack.Screen name="news" />
            <Stack.Screen name="settings" />
          </Stack>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
