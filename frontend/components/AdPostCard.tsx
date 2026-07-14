import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { Ad, adsApi } from '../lib/adsApi';

// Card de anúncio no feed — mesmo formato visual de um PostCard, mas com
// dados de uma campanha (não um Post real) e link externo em vez de rota interna.
export default function AdPostCard({ ad, viewerId }: { ad: Ad; viewerId?: string }) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const open = () => {
    adsApi.trackAdClick(ad.id, { viewerId, creativeId: ad.creativeId, format: 'post' });
    Linking.openURL(ad.targetUrl);
  };

  return (
    <TouchableOpacity style={styles.row} onPress={open} activeOpacity={0.92}>
      <View style={styles.tagRow}>
        <View style={styles.adTag}>
          <Ionicons name="megaphone-outline" size={11} color={Colors.accent} />
          <Text style={styles.adTagText}>Anúncio</Text>
        </View>
      </View>
      <Text style={styles.title}>{ad.title}</Text>
      <Text style={styles.body} numberOfLines={4}>{ad.content}</Text>
      {!!ad.imageUrl && <Image source={{ uri: ad.imageUrl }} style={styles.image} />}
      <View style={styles.ctaRow}>
        <Text style={styles.ctaText}>{ad.ctaLabel || 'Saiba mais'}</Text>
        <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  row: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tagRow: { flexDirection: 'row', marginBottom: 8 },
  adTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.accentLight,
  },
  adTagText: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 4, letterSpacing: -0.2 },
  body: { fontSize: 14, color: Colors.text, lineHeight: 20, marginBottom: 10 },
  image: { width: '100%', height: 180, borderRadius: 12, marginBottom: 10, backgroundColor: Colors.borderLight },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctaText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
