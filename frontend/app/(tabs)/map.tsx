import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import { CATEGORY_LIFESPAN_DAYS, DESKTOP_BREAKPOINT as WIDE } from '../../constants/config';
import { CATEGORY_ICONS, PostCategory, Post } from '../../data/mock';
import { api, NeighborhoodStats } from '../../lib/api';
import { adsApi, Ad } from '../../lib/adsApi';
import { getOrCreateAdViewerId } from '../../lib/storage';
import { useAuth } from '../../lib/auth';
import { formatDistance, haversineMeters } from '../../lib/location';
import { useRegisterScrollToTop } from '../../lib/scrollToTop';
import LeafletMap from '../../components/LeafletMap';
import FeedLayout from '../../components/FeedLayout';
import MobileMenu from '../../components/MobileMenu';
import { MapBounds, MapMarker } from '../../components/leafletHtml';

const MAP_HEIGHT = 440;
// Fallback quando o usuário não tem localização própria (sem "meu bairro" e
// sem GPS resolvido) — o mapa deixou de exigir isso pra abrir (ver pedido de
// deixar os pins visíveis pra todo mundo, não só de quem já tem endereço
// configurado). Centro aproximado de São Paulo (única cidade do Daqui hoje).
const DEFAULT_CENTER = { latitude: -23.5505, longitude: -46.6333 };

export default function MapScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ focus?: string; lat?: string; lng?: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;

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
  const [adCandidates, setAdCandidates] = useState<Ad[]>([]);
  const [adViewerId, setAdViewerId] = useState<string | undefined>(undefined);
  // Área realmente visível no mapa agora (ver leafletHtml.ts::sendBounds) —
  // é o que decide o que buscar, não mais o bairro do usuário.
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useRegisterScrollToTop('map', () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  });

  useEffect(() => {
    api.getNeighborhoodStats().then(setStats).catch(() => setStats(null));
  }, []);

  // Só busca posts quando já se sabe o recorte visível (o mapa precisa
  // renderizar com um centro antes de reportar seus bounds reais — ver
  // `center` abaixo). Refaz a cada pan/zoom (`bounds` muda), preservando a
  // posição em que o usuário deixou o mapa — nunca volta pro centro inicial.
  const boundsSeq = useRef(0);
  useEffect(() => {
    if (!bounds) return;
    const seq = ++boundsSeq.current;
    api
      .getMapPosts({ minLat: bounds.south, maxLat: bounds.north, minLng: bounds.west, maxLng: bounds.east })
      .then((mapPosts) => {
        if (seq === boundsSeq.current) setPosts(mapPosts);
      })
      .catch(() => {})
      .finally(() => {
        if (seq === boundsSeq.current) setLoading(false);
      });
  }, [bounds]);

  // Bairro mostrado no subtítulo abaixo de "Mapa": não é mais fixo no bairro
  // do usuário — acompanha o recorte visível, resolvendo o bairro do CENTRO
  // do viewport (aproximação simples de "bairro que ocupa a maior parte da
  // tela"; não existe no backend um bairro com polígono/área pra calcular
  // isso de verdade, só o ponto único que /geo/resolve já resolve). Só
  // dispara ~600ms depois do usuário parar de arrastar, pra não bater no
  // provedor de geocoding a cada frame do pan.
  const [viewportNeighborhood, setViewportNeighborhood] = useState<string | null>(null);
  useEffect(() => {
    if (!bounds) return;
    const centerLat = (bounds.south + bounds.north) / 2;
    const centerLng = (bounds.west + bounds.east) / 2;
    const timer = setTimeout(() => {
      api
        .resolveNeighborhood(centerLat, centerLng)
        .then((r) => setViewportNeighborhood(r.neighborhood))
        // Ponto sem bairro resolvível (ex.: sobre água) — mantém o último
        // nome válido em vez de piscar "bairro não configurado".
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [bounds]);

  useEffect(() => {
    getOrCreateAdViewerId().then(setAdViewerId);
  }, []);

  // Anúncios do formato "mapa" não são mais buscados por bairro — o pool
  // elegível é por cidade (`ads-backend` não tem noção de bounding box), e o
  // que efetivamente vira marker é filtrado abaixo por `bounds` no cliente
  // (ver `adsInBounds`). Sem rotação/espaçamento aqui: todos os elegíveis
  // dentro da área visível podem aparecer ao mesmo tempo.
  useEffect(() => {
    adsApi
      .getAds('map', {
        city: user?.city,
        engagement: (user?.interactionsCount ?? 0) >= 5 ? 'active' : undefined,
        viewerId: adViewerId,
        limit: 50,
      })
      .then(setAdCandidates)
      .catch(() => setAdCandidates([]));
  }, [user?.city, user?.interactionsCount, adViewerId]);

  const userLatitude = user?.latitude;
  const userLongitude = user?.longitude;
  const userCoords = useMemo(() => {
    if (userLatitude != null && userLongitude != null) {
      return { latitude: userLatitude, longitude: userLongitude };
    }
    return null;
  }, [userLatitude, userLongitude]);

  // Só posts com coordenadas viram pins (os sem local não aparecem).
  const located = useMemo(
    () => posts.filter((p) => p.latitude != null && p.longitude != null),
    [posts],
  );

  const adsInBounds = useMemo(() => {
    if (!bounds) return [];
    return adCandidates.filter(
      (a) =>
        a.latitude != null &&
        a.longitude != null &&
        a.latitude >= bounds.south &&
        a.latitude <= bounds.north &&
        a.longitude >= bounds.west &&
        a.longitude <= bounds.east,
    );
  }, [adCandidates, bounds]);

  // Real (não "foi buscado do backend"): só conta impressão pro anúncio que
  // ficar dentro da área visível do mapa por pelo menos 1s contínuo — mesmo
  // padrão de viewability usado no feed/mensagens/notificações (ver
  // lib/useAdImpression.ts), adaptado pra cá porque o mapa não usa FlatList.
  const trackedAdIdsRef = useRef<Set<number>>(new Set());
  const dwellTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const inBoundsIds = new Set(adsInBounds.map((a) => a.id));
    dwellTimersRef.current.forEach((timer, id) => {
      if (!inBoundsIds.has(id)) {
        clearTimeout(timer);
        dwellTimersRef.current.delete(id);
      }
    });
    for (const ad of adsInBounds) {
      if (trackedAdIdsRef.current.has(ad.id) || dwellTimersRef.current.has(ad.id)) continue;
      const timer = setTimeout(() => {
        dwellTimersRef.current.delete(ad.id);
        trackedAdIdsRef.current.add(ad.id);
        adsApi.trackAdImpression(ad.id, {
          viewerId: adViewerId,
          creativeId: ad.creativeId,
          format: 'map',
          neighborhood: user?.neighborhood,
        });
      }, 1000);
      dwellTimersRef.current.set(ad.id, timer);
    }
  }, [adsInBounds, adViewerId, user?.neighborhood]);

  useEffect(
    () => () => {
      dwellTimersRef.current.forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  // Foco vindo de outra tela > localização do usuário > centro padrão da
  // cidade. Não depende mais de `located` (posts) como o antigo fallback de
  // "média dos posts" dependia — bom, porque isso evita que o mapa "puxe" de
  // volta essa posição toda vez que um novo lote de posts chega por causa do
  // pan/zoom do usuário (nenhuma dessas fontes muda com o pan em si).
  const center = useMemo(() => focusCoords ?? userCoords ?? DEFAULT_CENTER, [focusCoords, userCoords]);

  const markers = useMemo(() => {
    const list: MapMarker[] = located.map((p) => ({
      id: p.id,
      latitude: p.latitude as number,
      longitude: p.longitude as number,
      color: p.important ? Colors.error : Colors.category[p.category] ?? Colors.primary,
      title: p.title || p.content.slice(0, 60),
      description: p.content,
      authorName: p.author.name,
      authorAvatar: p.author.avatar,
      imageUrl: p.media?.find((m) => m.type === 'image')?.url,
      createdAt: p.createdAt,
      maxAgeDays: CATEGORY_LIFESPAN_DAYS[p.category],
    }));
    for (const ad of adsInBounds) {
      list.push({
        id: `ad-${ad.id}`,
        latitude: ad.latitude as number,
        longitude: ad.longitude as number,
        color: Colors.accent,
        title: ad.title,
        description: ad.content,
        authorName: t('map.sponsoredAuthor'),
        imageUrl: ad.imageUrl,
      });
    }
    return list;
  }, [located, Colors, adsInBounds, t]);

  const handleBoundsChange = useCallback((b: MapBounds) => setBounds(b), []);

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

  // Ao tocar num símbolo de "pilha" no mapa (vários pins muito próximos —
  // ver STACK_THRESHOLD em leafletHtml.ts), a seção "perto de você" abaixo
  // do mapa troca pra listar só os posts daquele grupo, em vez de abrir um
  // post qualquer sem o usuário poder escolher qual.
  const [selectedStackIds, setSelectedStackIds] = useState<string[] | null>(null);
  const stackedPosts = useMemo(() => {
    if (!selectedStackIds) return [];
    const idSet = new Set(selectedStackIds);
    return located
      .filter((p) => idSet.has(p.id))
      .map((post) => ({
        post,
        meters: userCoords
          ? haversineMeters(userCoords, { latitude: post.latitude!, longitude: post.longitude! })
          : null,
      }));
  }, [located, selectedStackIds, userCoords]);
  const nearbySectionItems = selectedStackIds ? stackedPosts : nearby;

  return (
    <FeedLayout showMobileMenu={false}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        {/* Header — padrão claro, uniforme com as demais telas (mobile e desktop) */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTexts}>
              <Text style={styles.headerTitle}>{t('map.title')}</Text>
              <View style={styles.headerSub}>
                <Ionicons name="location" size={14} color={Colors.primary} />
                <Text style={styles.headerSubText}>
                  {viewportNeighborhood || user?.neighborhood || t('map.neighborhoodNotSet')}
                </Text>
              </View>
            </View>
            {!isWide && <MobileMenu inline />}
          </View>
        </View>

        {/* Map area */}
        <View style={styles.mapWrapper}>
          <LeafletMap
            center={center}
            zoom={focusCoords ? 17 : 15}
            markers={markers}
            focusId={params.focus}
            onBoundsChange={handleBoundsChange}
            onSelectStack={setSelectedStackIds}
            onSelectMarker={(id) => {
              const clickedAd = adsInBounds.find((a) => `ad-${a.id}` === id);
              if (clickedAd) {
                adsApi.trackAdClick(clickedAd.id, {
                  viewerId: adViewerId,
                  creativeId: clickedAd.creativeId,
                  format: 'map',
                });
                Linking.openURL(clickedAd.targetUrl);
                return;
              }
              router.push(`/post/${id}` as any);
            }}
            style={styles.map}
          />
          {loading && (
            <View style={styles.mapLoading}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendRow}>
            {(Object.entries(Colors.category) as [PostCategory, string][]).map(([key, color]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{t(`categories.${key}`)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Nearby section (ou os posts do grupo de pins tocado no mapa) */}
        <View style={styles.nearbySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedStackIds ? t('map.stackTitle', { count: selectedStackIds.length }) : t('map.nearYou')}
            </Text>
            {selectedStackIds && (
              <TouchableOpacity
                onPress={() => setSelectedStackIds(null)}
                hitSlop={8}
                accessibilityLabel={t('map.backToNearby')}
              >
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {nearbySectionItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="map-outline" size={28} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>{t('map.noLocatedPosts')}</Text>
            </View>
          ) : (
            <View style={styles.nearbyList}>
              {nearbySectionItems.map(({ post, meters }) => {
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
                          {meters != null ? formatDistance(meters) : (post.location ?? t('map.inNeighborhood'))}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.nearbyCategory, { backgroundColor: catColor + '15' }]}>
                      <Text style={[styles.nearbyCategoryText, { color: catColor }]}>
                        {t(`categories.${post.category}`)}
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
                <Text style={styles.heatTitle}>{t('map.activityTitle')}</Text>
                <Text style={styles.heatDesc}>
                  {stats ? t('map.activityStats', { posts: stats.posts, neighbors: stats.neighbors }) : '—'}
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
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTexts: { flex: 1 },
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
  mapLoading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface + 'A3',
    pointerEvents: 'none',
  },
  legend: { paddingVertical: 4 },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    columnGap: 12,
    rowGap: 8,
  },
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
