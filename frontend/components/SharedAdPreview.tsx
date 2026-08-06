import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Palette } from '../constants/Colors';
import { Ad } from '../lib/adsApi';
import { useTheme, useThemedStyles } from '../lib/theme';
import { useT } from '../lib/i18n';

interface Props {
  ad: Ad;
  // Quando true, apenas exibe (sem navegar) — usado na tela de encaminhar.
  static?: boolean;
}

// Prévia de um anúncio encaminhado numa conversa (mesmo padrão de
// SharedPostPreview) — o anúncio é resolvido no client via adsApi.getAdById,
// já que ele vive no ads-backend, fora do alcance do backend de mensagens.
export default function SharedAdPreview({ ad, static: isStatic }: Props) {
  const { t } = useT();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const body = (
    <>
      <View style={styles.tagRow}>
        <Ionicons name="megaphone-outline" size={11} color={Colors.accent} />
        <Text style={styles.tagText}>{t('ads.ad')}</Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>{ad.title}</Text>
      {!!ad.content && <Text style={styles.body} numberOfLines={3}>{ad.content}</Text>}

      {!!ad.imageUrl && (
        <Image source={{ uri: ad.imageUrl }} style={styles.image} resizeMode="cover" />
      )}

      {!isStatic && (
        <View style={styles.footer}>
          <Ionicons name="open-outline" size={12} color={Colors.textTertiary} />
          <Text style={styles.footerText}>{t('shared.viewPost')}</Text>
        </View>
      )}
    </>
  );

  if (isStatic) return <View style={styles.card}>{body}</View>;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/ad/${ad.id}?creativeId=${ad.creativeId}` as any)}
    >
      {body}
    </TouchableOpacity>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 10,
    gap: 4,
    minWidth: 220,
  },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  title: { fontSize: 14, fontWeight: '800', color: Colors.text, letterSpacing: -0.2, marginTop: 2 },
  body: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  image: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: Colors.border,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  footerText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '600' },
});
