import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Palette } from '../constants/Colors';
import { Post } from '../data/mock';
import { useTheme, useThemedStyles } from '../lib/theme';
import { useT } from '../lib/i18n';
import { activeLocale } from '../lib/time';
import { Coords, haversineMeters, formatDistance } from '../lib/location';
import { getPostStatus } from '../lib/postStatus';

function formatPrice(price: number): string {
  return price.toLocaleString(activeLocale(), {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface SaleGridCardProps {
  post: Post;
  // Coordenadas de referência da visualização ativa ("Meu bairro"/"Perto de
  // mim", ver app/(tabs)/index.tsx) — a distância é sempre calculada no
  // cliente, não vem do backend.
  referenceCoords?: Coords | null;
}

export default function SaleGridCard({ post, referenceCoords }: SaleGridCardProps) {
  const { t } = useT();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const status = getPostStatus(post);
  const image = post.media?.find((m) => m.type === 'image')?.url;
  const priceLabel = post.priceNegotiable
    ? t('publish.sale.negotiable')
    : typeof post.price === 'number'
    ? formatPrice(post.price)
    : null;
  const distanceLabel =
    referenceCoords && post.latitude != null && post.longitude != null
      ? formatDistance(haversineMeters(referenceCoords, { latitude: post.latitude, longitude: post.longitude }))
      : null;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/${post.author.username}/post/${post.publicId}` as any)}
    >
      <View style={styles.imageWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={28} color={Colors.textTertiary} />
          </View>
        )}
        {status === 'sold' && (
          <View style={styles.soldBadge}>
            <Text style={styles.soldBadgeText}>{t('post.status.sold')}</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        {!!post.productName && (
          <Text style={styles.productName} numberOfLines={2}>{post.productName}</Text>
        )}
        {!!priceLabel && <Text style={styles.price}>{priceLabel}</Text>}
        {(!!post.location || !!distanceLabel) && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={11} color={Colors.textTertiary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {[post.location, distanceLabel].filter(Boolean).join(' · ')}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  imageWrap: { aspectRatio: 1, backgroundColor: Colors.background },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  soldBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  soldBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  info: { padding: 10, gap: 3 },
  productName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  price: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  metaText: { fontSize: 11, color: Colors.textTertiary, flexShrink: 1 },
});
