import { View, Text, StyleSheet, TouchableOpacity, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Palette } from '../../../constants/Colors';
import { useTheme, useThemedStyles } from '../../../lib/theme';

export default function CheckoutSuccessScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [copied, setCopied] = useState(false);

  const panelPath = token ? `/anunciar/painel/${token}` : '';
  const panelUrl =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}${panelPath}`
      : panelPath;

  const copyLink = async () => {
    if (!panelUrl) return;
    if (Platform.OS === 'web' && navigator.clipboard) {
      await navigator.clipboard.writeText(panelUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      await Share.share({ message: panelUrl });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={36} color="#fff" />
        </View>
        <Text style={styles.title}>Anúncio recebido!</Text>
        <Text style={styles.subtitle}>
          Assim que o pagamento for confirmado, seu anúncio entra no ar. Guarde o link
          abaixo — é por ele que você acompanha o status e os resultados do seu anúncio,
          sem precisar de login.
        </Text>

        {panelUrl ? (
          <>
            <TouchableOpacity style={styles.linkBox} onPress={copyLink} activeOpacity={0.8}>
              <Ionicons name="link-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.linkText} numberOfLines={1}>{panelUrl}</Text>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={Colors.primary} />
            </TouchableOpacity>
            {copied && <Text style={styles.copiedText}>Link copiado!</Text>}

            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={() => router.replace(`/anunciar/painel/${token}` as any)}
            >
              <Text style={styles.primaryBtnText}>Ver meu anúncio</Text>
            </TouchableOpacity>
          </>
        ) : null}

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/')}>
          <Text style={styles.secondaryBtnText}>Voltar para o Daqui</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    marginTop: 8,
  },
  linkText: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  copiedText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  primaryBtn: {
    marginTop: 8,
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  secondaryBtn: { marginTop: 4, paddingVertical: 10 },
  secondaryBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textTertiary },
});
