import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Image,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { BRAND_FONT } from '../../constants/BrandFont';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { CATEGORIES, PostCategory, Post } from '../../data/mock';
import { api } from '../../lib/api';
import { adsApi, Ad } from '../../lib/adsApi';
import { getOrCreateAdViewerId } from '../../lib/storage';
import { getDeviceCoords, LocationError, Coords } from '../../lib/location';
import { useAuth } from '../../lib/auth';
import { useRegisterScrollToTop } from '../../lib/scrollToTop';
import PostCard from '../../components/PostCard';
import AdPostCard from '../../components/AdPostCard';
import LeftSidebar from '../../components/LeftSidebar';
import RightSidebar from '../../components/RightSidebar';
import MobileMenu from '../../components/MobileMenu';
import HomeNeighborhoodSetup from '../../components/HomeNeighborhoodSetup';

type FilterKey = 'todos' | PostCategory;
type ViewMode = 'meu' | 'perto';
type FeedItem = { kind: 'post'; post: Post } | { kind: 'ad'; ad: Ad };

const WIDE = 900;

export default function FeedScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const { user } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [activeCategory, setActiveCategory] = useState<FilterKey>('todos');
  const [importantOnly, setImportantOnly] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedAd, setFeedAd] = useState<Ad | null>(null);
  const [adViewerId, setAdViewerId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<FeedItem>>(null);

  // Visualização ativa e preferência de "redondezas" por visualização.
  // Padrão "perto de mim": "Meu bairro" pode exigir configurar o bairro antes.
  const [viewMode, setViewMode] = useState<ViewMode>('perto');
  const [nearbyMeu, setNearbyMeu] = useState(false);
  const [nearbyPerto, setNearbyPerto] = useState(false);
  // "Perto de mim": bairro/coords resolvidos pelo GPS atual do dispositivo.
  const [pertoCoords, setPertoCoords] = useState<Coords | null>(null);
  const [pertoNeighborhood, setPertoNeighborhood] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const nearbyActive = viewMode === 'meu' ? nearbyMeu : nearbyPerto;

  // Animação de slide ao alternar as abas.
  const contentX = useSharedValue(0);
  const indicator = useSharedValue(1); // 0 = "meu", 1 = "perto" (padrão: "perto")
  const [tabsWidth, setTabsWidth] = useState(0);

  useRegisterScrollToTop('index', () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  });

  // Descobre o bairro atual pelo GPS (usado sempre que a aba "Perto de mim" é ativada).
  const fetchPertoLocation = useCallback(async () => {
    setLocError(null);
    setLocLoading(true);
    try {
      const coords = await getDeviceCoords();
      const res = await api.resolveNeighborhood(coords.latitude, coords.longitude);
      setPertoCoords(coords);
      setPertoNeighborhood(res.neighborhood);
    } catch (e) {
      setPertoCoords(null);
      setPertoNeighborhood(null);
      setLocError(
        e instanceof LocationError
          ? e.message
          : 'Não foi possível descobrir seu bairro agora.',
      );
    } finally {
      setLocLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      let feed: Post[];
      if (viewMode === 'meu') {
        // Sem "Meu bairro" configurado ainda: a UI mostra a configuração.
        if (!user?.neighborhood) {
          setPosts([]);
          return;
        }
        feed = await api.getFeed({
          includeNearby: nearbyMeu,
          latitude: user?.latitude,
          longitude: user?.longitude,
        });
      } else {
        // Sem localização resolvida ainda: a UI mostra o estado de localização.
        if (!pertoNeighborhood || !pertoCoords) {
          setPosts([]);
          return;
        }
        feed = await api.getFeed({
          neighborhood: pertoNeighborhood,
          latitude: pertoCoords.latitude,
          longitude: pertoCoords.longitude,
          includeNearby: nearbyPerto,
        });
      }
      setPosts(feed);
    } catch {
      setError('Não foi possível carregar o feed.');
    } finally {
      setLoading(false);
    }
  }, [viewMode, nearbyMeu, nearbyPerto, pertoCoords, pertoNeighborhood, user]);

  // Recarrega ao focar a tela e sempre que a visualização/preferências mudam
  // (reflete novos posts, curtidas e comentários).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const activeNeighborhood = viewMode === 'meu' ? user?.neighborhood : pertoNeighborhood ?? undefined;

  useEffect(() => {
    getOrCreateAdViewerId().then(setAdViewerId);
  }, []);

  useFocusEffect(
    useCallback(() => {
      adsApi
        .getAd('post', {
          neighborhood: activeNeighborhood ?? undefined,
          viewMode: viewMode === 'meu' ? 'home' : 'nearby',
          category: activeCategory !== 'todos' ? activeCategory : undefined,
          engagement: (user?.interactionsCount ?? 0) >= 5 ? 'active' : undefined,
          viewerId: adViewerId,
        })
        .then(setFeedAd)
        .catch(() => setFeedAd(null));
    }, [activeNeighborhood, viewMode, activeCategory, user?.interactionsCount, adViewerId]),
  );

  const switchView = useCallback((mode: ViewMode) => {
    if (mode === viewMode) {
      // Retoque na aba "Perto de mim" reobtém a localização.
      if (mode === 'perto') fetchPertoLocation();
      return;
    }
    const dir = mode === 'perto' ? 1 : -1;
    contentX.value = dir * 60;
    contentX.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    indicator.value = withTiming(mode === 'perto' ? 1 : 0, {
      duration: 220,
      easing: Easing.inOut(Easing.cubic),
    });
    setViewMode(mode);
    if (mode === 'perto') fetchPertoLocation();
  }, [viewMode, fetchPertoLocation, contentX, indicator]);

  const onIncludeNearbyChange = useCallback(
    (value: boolean) => {
      if (viewMode === 'meu') setNearbyMeu(value);
      else setNearbyPerto(value);
    },
    [viewMode],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (viewMode === 'perto') await fetchPertoLocation();
    await load();
    setRefreshing(false);
  }, [viewMode, fetchPertoLocation, load]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentX.value }],
  }));
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicator.value * (tabsWidth / 2) }],
  }));

  const filteredPosts = posts.filter(
    (p) =>
      (activeCategory === 'todos' || p.category === activeCategory) &&
      (!importantOnly || p.important),
  );

  // O anúncio (se houver) entra numa posição fixa da lista — sem vaga
  // reservada quando não existe (feedAd null não altera o array).
  const feedItems: FeedItem[] = feedAd
    ? [
        ...filteredPosts.slice(0, 2).map((post): FeedItem => ({ kind: 'post', post })),
        { kind: 'ad', ad: feedAd },
        ...filteredPosts.slice(2).map((post): FeedItem => ({ kind: 'post', post })),
      ]
    : filteredPosts.map((post): FeedItem => ({ kind: 'post', post }));

  // View tabs: "Meu bairro" | "Perto de mim" (desktop e mobile) — presente
  // tanto no feed quanto na configuração de "Meu bairro", para o usuário
  // conseguir sair da configuração a qualquer momento.
  const viewTabsBlock = (
    <View
      style={styles.viewTabs}
      onLayout={(e) => setTabsWidth(e.nativeEvent.layout.width)}
    >
      {(['meu', 'perto'] as ViewMode[]).map((mode) => {
        const isActive = viewMode === mode;
        return (
          <TouchableOpacity
            key={mode}
            style={styles.viewTab}
            activeOpacity={0.7}
            onPress={() => switchView(mode)}
          >
            <Ionicons
              name={mode === 'meu' ? 'home' : 'navigate'}
              size={15}
              color={isActive ? Colors.primary : Colors.textTertiary}
            />
            <Text style={[styles.viewTabText, isActive && styles.viewTabTextActive]}>
              {mode === 'meu' ? 'Meu bairro' : 'Perto de mim'}
            </Text>
          </TouchableOpacity>
        );
      })}
      <Animated.View
        style={[styles.viewTabIndicator, { width: tabsWidth / 2 }, indicatorStyle]}
      />
    </View>
  );

  const feedHeader = (
    <>
      {/* Compose box */}
      <View style={styles.composeBox}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
          <Image source={{ uri: user?.avatar }} style={styles.composeAvatar} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.composeFakeInput}
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/publish')}
        >
          <Text style={styles.composePlaceholder}>
            Postar uma mensagem, evento, enquete ou aviso importante
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.composeDivider} />

      {viewTabsBlock}

      {/* Category filter tabs */}
      {!isWide && (
        <View style={styles.mobileTabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileTabsRow}>
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key;
              const color = cat.key === 'todos' ? Colors.primary : (Colors.category[cat.key as PostCategory] ?? Colors.primary);
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.mobileTab, isActive && { borderBottomColor: color }]}
                  onPress={() => setActiveCategory(cat.key as FilterKey)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={cat.icon as any} size={12} color={isActive ? color : Colors.textTertiary} />
                  <Text style={[styles.mobileTabText, isActive && { color, fontWeight: '700' }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.hairline} />
    </>
  );

  // Estado exibido no corpo do feed vazio: prioriza a resolução de localização
  // na aba "Perto de mim".
  const renderEmpty = () => {
    if (viewMode === 'perto' && locLoading) {
      return (
        <View style={styles.feedState}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.feedStateText}>Descobrindo seu bairro…</Text>
        </View>
      );
    }
    if (viewMode === 'perto' && locError) {
      return (
        <View style={styles.feedState}>
          <Ionicons name="location-outline" size={32} color={Colors.textTertiary} />
          <Text style={styles.feedStateText}>{locError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchPertoLocation}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (loading) {
      return (
        <View style={styles.feedState}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      );
    }
    return (
      <View style={styles.feedState}>
        <Ionicons
          name={error ? 'cloud-offline-outline' : 'newspaper-outline'}
          size={32}
          color={Colors.textTertiary}
        />
        <Text style={styles.feedStateText}>
          {error ?? 'Nenhum post por aqui ainda.'}
        </Text>
        {error && (
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // "Meu bairro" ainda não configurado: mostra a configuração (mesmo fluxo do
  // cadastro, com escolha de redondezas) em vez do feed.
  const needsHomeSetup = viewMode === 'meu' && !user?.neighborhood;

  const feed = needsHomeSetup ? (
    <Animated.View style={[styles.feedFill, contentStyle]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {viewTabsBlock}
        <HomeNeighborhoodSetup />
      </ScrollView>
    </Animated.View>
  ) : (
    <Animated.View style={[styles.feedFill, contentStyle]}>
      <FlatList
        ref={listRef}
        data={feedItems}
        keyExtractor={(item) => (item.kind === 'post' ? item.post.id : `ad-${item.ad.id}`)}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={feedHeader}
        renderItem={({ item }) => (item.kind === 'post' ? <PostCard post={item.post} /> : <AdPostCard ad={item.ad} viewerId={adViewerId} />)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={renderEmpty}
      />
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ─── Body: 3-column on wide, 1-column on mobile ─── */}
      {isWide ? (
        <View style={[styles.wideBody, { paddingHorizontal: Math.max(0, (width - 1140) / 2) }]}>
          {/* Left sidebar — sticky */}
          <ScrollView style={styles.leftCol} showsVerticalScrollIndicator={false}>
            <LeftSidebar
              activeCategory={activeCategory}
              onCategoryChange={(k) => setActiveCategory(k as FilterKey)}
              importantOnly={importantOnly}
              onImportantChange={setImportantOnly}
              includeNearby={nearbyActive}
              onIncludeNearbyChange={onIncludeNearbyChange}
            />
          </ScrollView>

          {/* Center feed */}
          <View style={styles.centerCol}>
            {feed}
          </View>

          {/* Right sidebar */}
          <ScrollView style={styles.rightCol} showsVerticalScrollIndicator={false}>
            <RightSidebar />
          </ScrollView>
        </View>
      ) : (
        <View style={styles.mobileBody}>
          <View style={styles.mobileTopBar}>
            <Text style={styles.mobileBrand}>daqui</Text>
            <MobileMenu
              inline
              activeCategory={activeCategory}
              onCategoryChange={(k) => setActiveCategory(k as FilterKey)}
              importantOnly={importantOnly}
              onImportantChange={setImportantOnly}
              includeNearby={nearbyActive}
              onIncludeNearbyChange={onIncludeNearbyChange}
            />
          </View>
          {feed}
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* ── Wide 3-col layout ── */
  wideBody: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  leftCol: {
    width: 220,
    flexShrink: 0,
    backgroundColor: Colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  centerCol: {
    width: 640,
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: Colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  rightCol: {
    width: 280,
    flexShrink: 0,
    backgroundColor: Colors.background,
  },

  /* ── Mobile layout ── */
  mobileBody: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  mobileBrand: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: -0.5,
    fontFamily: BRAND_FONT,
  },

  /* ── Feed header pieces ── */
  composeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
  },
  composeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  composeFakeInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  composePlaceholder: {
    fontSize: 13,
    color: Colors.textTertiary,
    lineHeight: 17,
  },
  composeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  feedFill: { flex: 1 },
  /* ── View tabs (Meu bairro / Perto de mim) ── */
  viewTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
  viewTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  viewTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  viewTabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  viewTabIndicator: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 2.5,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  mobileTabs: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  mobileTabsRow: {
    paddingHorizontal: 8,
    flexDirection: 'row',
  },
  mobileTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  mobileTabText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  listContent: { paddingBottom: 24 },
  feedState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 10,
  },
  feedStateText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: Colors.primaryFaint,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
