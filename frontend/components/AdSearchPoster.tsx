import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { Ad, adsApi } from '../lib/adsApi';
import VideoPlayer from './VideoPlayer';
import { useT } from '../lib/i18n';

// Poster mostrado só no estado vazio da aba Busca (antes do usuário digitar
// algo) — desaparece completamente quando não há campanha ativa para o formato.
export default function AdSearchPoster({
  ad,
  viewerId,
  neighborhood,
}: {
  ad: Ad;
  viewerId?: string;
  neighborhood?: string;
}) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();

  // Sem viewability real (a lista roda dentro de um ScrollView comum, sem
  // virtualização/threshold de visibilidade como o FlatList — ver
  // lib/useAdImpression.ts). Como aproximação, loga uma impressão por
  // anúncio montado, uma vez só (o componente só remonta se o id mudar,
  // já que a chave da lista em search.tsx é `a.id`).
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    adsApi.trackAdImpression(ad.id, { viewerId, creativeId: ad.creativeId, format: 'search_poster', neighborhood });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad.id]);

  const open = () => {
    adsApi.trackAdClick(ad.id, { viewerId, creativeId: ad.creativeId, format: 'search_poster' });
    Linking.openURL(ad.targetUrl);
  };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={open}>
      {!!ad.videoUrl ? (
        <VideoPlayer uri={ad.videoUrl} style={styles.image} />
      ) : (
        !!ad.imageUrl && <Image source={{ uri: ad.imageUrl }} style={styles.image} />
      )}
      <View style={styles.body}>
        <View style={styles.tag}>
          <Ionicons name="megaphone-outline" size={11} color={Colors.accent} />
          <Text style={styles.tagText}>{t('ads.ad')}</Text>
        </View>
        <Text style={styles.title}>{ad.title}</Text>
        <Text style={styles.desc} numberOfLines={3}>{ad.content}</Text>
        <View style={styles.ctaRow}>
          <Text style={styles.ctaText}>{ad.ctaLabel || t('ads.learnMore')}</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  image: { width: '100%', height: 140, backgroundColor: Colors.borderLight },
  body: { padding: 14, gap: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.accentLight,
  },
  tagText: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  desc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  ctaText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
