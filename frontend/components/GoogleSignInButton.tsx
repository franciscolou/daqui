import { useState } from 'react';
import { ActivityIndicator, StyleProp, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

// Versão nativa (iOS/Android) — ver GoogleSignInButton.web.tsx para a versão
// web (biblioteca nativa não roda no browser). GoogleSignin exige um
// development build (não funciona no Expo Go); ver app.json (plugin
// @react-native-google-signin/google-signin) e CLAUDE.md sobre como
// configurar os client IDs no Google Cloud Console antes de rebuildar.
let configured = false;
function ensureConfigured() {
  if (configured) return;
  configured = true;
  GoogleSignin.configure({
    // Mesmo webClientId usado pelo backend como audience (ver
    // backend/app/core/config.py::GOOGLE_WEB_CLIENT_ID) — é o que faz o
    // idToken devolvido aqui (mesmo em iOS/Android) validar do outro lado.
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  });
}

export default function GoogleSignInButton({
  style,
  textStyle,
  onIdToken,
  onError,
}: {
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  onIdToken: (idToken: string) => void;
  onError?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      ensureConfigured();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        if (response.data.idToken) onIdToken(response.data.idToken);
        else onError?.('Não foi possível obter o token do Google.');
      }
      // resposta "cancelled": usuário desistiu, não é um erro a reportar.
    } catch (e) {
      if (!isErrorWithCode(e) || e.code !== statusCodes.SIGN_IN_CANCELLED) {
        onError?.('Não foi possível entrar com o Google.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity style={style} onPress={handlePress} activeOpacity={0.85} disabled={busy}>
      {busy
        ? <ActivityIndicator size="small" color="#EA4335" />
        : <Ionicons name="logo-google" size={20} color="#EA4335" />}
      <Text style={textStyle}>Google</Text>
    </TouchableOpacity>
  );
}
