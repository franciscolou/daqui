import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { CATEGORY_LABELS, CATEGORY_ICONS, PostCategory, Post } from '../../data/mock';
import { api, NeighborhoodStats } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDistance, haversineMeters } from '../../lib/location';
import { useRegisterScrollToTop } from '../../lib/scrollToTop';
import LeafletMap from '../../components/LeafletMap';
import FeedLayout from '../../components/FeedLayout';

const MAP_HEIGHT = 440;

// Centro padrão (Leme, Rio) caso ainda não haja coordenadas do usuário/posts.
const FALLBACK_CENTER = { latitude: -22.9631, longitude: -43.1665 };

export default function MapScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const params = useLocalSearchParams<{ focus?: string; lat?: string; lng?: string }>();

  // Coordenadas para focar, vindas de outra tela (ex.: um post) via query params.
  const focusCoords = useMemo(() => {
    const lat = Number(params.lat);
    const lng = Number(params.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
    return null;
  }, [params.lat, params.lng]);

  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<NeighborhoodStats | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  useRegisterScrollToTop('map', () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  });

  useEffect(() => {
    Promise.all([api.getMapPosts(), api.getNeighborhoodStats().catch(() => null)])
      .then(([mapPosts, s]) => {
        setPosts(mapPosts);
        setStats(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const userCoords = useMemo(() => {
    if (user?.latitude != null && user?.longitude != null) {
      return { latitude: user.latitude, longitude: user.longitude };
    }
    return null;
  }, [user?.latitude, user?.longitude]);

  // Só posts com coordenadas viram pins (os sem local não aparecem).
  const located = useMemo(
    () => posts.filter((p) => p.latitude != null && p.longitude != null),
    [posts],
  );

  const center = useMemo(() => {
    if (focusCoords) return focusCoords;
    if (userCoords) return userCoords;
    if (located.length) {
      const lat = located.reduce((s, p) => s + (p.latitude ?? 0), 0) / located.length;
      const lon = located.reduce((s, p) => s + (p.longitude ?? 0), 0) / located.length;
      return { latitude: lat, longitude: lon };
    }
    return FALLBACK_CENTER;
  }, [focusCoords, userCoords, located]);

  const markers = useMemo(
    () =>
      located.map((p) => ({
        id: p.id,
        latitude: p.latitude as number,
        longitude: p.longitude as number,
        color: p.important ? Colors.error : Colors.category[p.category] ?? Colors.primary,
        title: p.title || p.content.slice(0, 60),
        description: p.content,
        authorName: p.author.name,
        authorAvatar: p.author.avatar,
        imageUrl: p.images?.[0],
      })),
    [located, Colors],
  );

  const nearby = useMemo(() => {
    const withDist = located.map((p) => ({
      post: p,
      meters: userCoords
        ? haversineMeters(userCoords, { latitude: p.latitude!, longitude: p.longitude! })
        : null,
    }));
    withDist.sort((a, b) => (a.meters ?? Infinity) - (b.meters ?? Infinity));
    return withDist.slice(0, 4);
  }, [located, userCoords]);

  return (
    <FeedLayout>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        {/* Header — padrão claro, uniforme com as demais telas (mobile e desktop) */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mapa do Bairro</Text>
          <View style={styles.headerSub}>
            <Ionicons name="location" size={14} color={Colors.primary} />
            <Text style={styles.headerSubText}>{user?.neighborhood ?? 'Seu bairro'}</Text>
          </View>
        </View>

        {/* Map area */}
        <View style={styles.mapWrapper}>
          {loading ? (
            <View style={styles.mapLoading}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          ) : (
            <LeafletMap
              center={center}
              zoom={focusCoords ? 17 : 15}
              markers={markers}
              focusId={params.focus}
              onSelectMarker={(id) => router.push(`/post/${id}` as any)}
              style={styles.map}
            />
          )}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendRow}>
            {(Object.entries(Colors.category) as [PostCategory, string][]).map(([key, color]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{CATEGORY_LABELS[key]}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Nearby section */}
        <View style={styles.nearbySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Perto de você</Text>
          </View>

          {nearby.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="map-outline" size={28} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>Nenhum post com local no bairro ainda.</Text>
            </View>
          ) : (
            <View style={styles.nearbyList}>
              {nearby.map(({ post, meters }) => {
                const catColor = post.important
                  ? Colors.error
                  : Colors.category[post.category] ?? Colors.primary;
                return (
                  <TouchableOpacity
                    key={post.id}
                    style={styles.nearbyCard}
                    activeOpacity={0.9}
                    onPress={() => router.push(`/post/${post.id}` as any)}
                  >
                    <View style={[styles.nearbyIconBox, { backgroundColor: catColor + '15' }]}>
                      <Ionicons name={CATEGORY_ICONS[post.category] as any} size={20} color={catColor} />
                    </View>
                    <View style={styles.nearbyInfo}>
                      <Text style={styles.nearbyTitle} numberOfLines={1}>
                        {post.title ?? post.content}
                      </Text>
                      <View style={styles.nearbyMeta}>
                        <Ionicons name="navigate-outline" size={11} color={Colors.textTertiary} />
                        <Text style={styles.nearbyMetaText}>
                          {meters != null ? formatDistance(meters) : (post.location ?? 'no bairro')}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.nearbyCategory, { backgroundColor: catColor + '15' }]}>
                      <Text style={[styles.nearbyCategoryText, { color: catColor }]}>
                        {CATEGORY_LABELS[post.category]}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Activity card */}
        <View style={styles.heatCard}>
          <LinearGradient colors={Colors.gradient.primary} style={styles.heatGradient}>
            <View style={styles.heatContent}>
              <View>
                <Text style={styles.heatTitle}>Atividade do bairro</Text>
                <Text style={styles.heatDesc}>
                  {stats ? `${stats.posts} posts · ${stats.neighbors} vizinhos` : '—'}
                </Text>
              </View>
              <View style={styles.heatIcon}>
                <Ionicons name="pulse" size={26} color="rgba(255,255,255,0.9)" />
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </FeedLayout>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerSubText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  mapWrapper: {
    margin: 16,
    height: MAP_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.surface,
    ...Colors.shadow.md,
  },
  map: { flex: 1, width: '100%', height: '100%' },
  mapLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  legend: { paddingVertical: 4 },
  legendRow: { paddingHorizontal: 16, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  nearbySection: { paddingTop: 16, paddingBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 16 },
  emptyText: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center' },
  nearbyList: { paddingHorizontal: 16, gap: 10 },
  nearbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Colors.shadow.sm,
  },
  nearbyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyInfo: { flex: 1 },
  nearbyTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  nearbyMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  nearbyMetaText: { fontSize: 11, color: Colors.textTertiary },
  nearbyCategory: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  nearbyCategoryText: { fontSize: 11, fontWeight: '700' },
  heatCard: {
    margin: 16,
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    ...Colors.shadow.md,
  },
  heatGradient: { borderRadius: 16 },
  heatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  heatTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  heatDesc: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  heatIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
