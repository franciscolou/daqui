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
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { BRAND_FONT } from '../../constants/BrandFont';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { useT } from '../../lib/i18n';
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

const normalizeNeighborhood = (value?: string | null) =>
  value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR') ?? '';

export default function FeedScreen() {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const { user } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { view: requestedView } = useLocalSearchParams<{ view?: string }>();

  const [activeCategory, setActiveCategory] = useState<FilterKey>('todos');
  const [importantOnly, setImportantOnly] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedAd, setFeedAd] = useState<Ad | null>(null);
  const [adViewerId, setAdViewerId] = useState<string | undefined>(undefined);
  const [adViewerReady, setAdViewerReady] = useState(false);
  const [adLoading, setAdLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<FeedItem>>(null);

  // Visualização ativa e preferência de "redondezas" por visualização.
  // Padrão "perto de mim": "Meu bairro" pode exigir configurar o bairro antes.
  // Semeada a partir da preferência persistida (User.includeNearby) — que
  // também decide, no backend, se este usuário recebe aviso de post
  // importante de bairros vizinhos (ver services/post.py::create_post).
  const [viewMode, setViewMode] = useState<ViewMode>('perto');
  const [nearbyMeu, setNearbyMeu] = useState(() => !!user?.includeNearby);
  const [nearbyPerto, setNearbyPerto] = useState(() => !!user?.includeNearby);
  // "Perto de mim": bairro/coords resolvidos pelo GPS atual do dispositivo.
  const [pertoCoords, setPertoCoords] = useState<Coords | null>(null);
  const [pertoNeighborhood, setPertoNeighborhood] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [initialViewLoading, setInitialViewLoading] = useState(true);

  const nearbyActive = viewMode === 'meu' ? nearbyMeu : nearbyPerto;

  // Animação de slide ao alternar as abas. Aplicada só ao conteúdo (posts),
  // não ao header/abas — ver uso em `renderItem` do FlatList.
  const contentX = useSharedValue(0);
  const contentOpacity = useSharedValue(1);
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
          : t('feed.errors.location'),
      );
    } finally {
      setLocLoading(false);
    }
  }, [t]);

  const PAGE_SIZE = 20;

  // Monta os parâmetros de busca do feed pra visualização ativa, ou `null`
  // quando ainda falta pré-requisito (bairro configurado / localização
  // resolvida) — mesma checagem usada tanto na carga inicial quanto no "load
  // more" da rolagem infinita.
  const feedParams = useCallback(
    (pageNum: number) => {
      if (viewMode === 'meu') {
        if (!user?.neighborhood) return null;
        return {
          includeNearby: nearbyMeu,
          latitude: user?.latitude,
          longitude: user?.longitude,
          page: pageNum,
          pageSize: PAGE_SIZE,
        };
      }
      if (!pertoNeighborhood || !pertoCoords) return null;
      return {
        neighborhood: pertoNeighborhood,
        latitude: pertoCoords.latitude,
        longitude: pertoCoords.longitude,
        includeNearby: nearbyPerto,
        page: pageNum,
        pageSize: PAGE_SIZE,
      };
    },
    [viewMode, nearbyMeu, nearbyPerto, pertoCoords, pertoNeighborhood, user],
  );

  const [page, setPage] = useState(1);
  const [totalPosts, setTotalPosts] = useState(0);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  // Sequência da carga atual — invalida uma resposta de "load more" que
  // chegue atrasada depois que o usuário já trocou de visualização/bairro
  // (senão ela apareceria colada num feed que já é de outro contexto).
  const feedSeq = useRef(0);
  const adSeq = useRef(0);
  const loadingMorePostsRef = useRef(false);

  const load = useCallback(async () => {
    if (initialViewLoading) return;
    const seq = ++feedSeq.current;
    try {
      setLoading(true);
      setError(null);
      const params = feedParams(1);
      if (!params) {
        setPosts([]);
        setTotalPosts(0);
        setPage(1);
        return;
      }
      const feed = await api.getFeed(params);
      if (seq !== feedSeq.current) return;
      setPosts(feed.items);
      setTotalPosts(feed.total);
      setPage(1);
    } catch {
      if (seq !== feedSeq.current) return;
      setError(t('feed.errors.load'));
    } finally {
      if (seq === feedSeq.current) setLoading(false);
    }
  }, [feedParams, initialViewLoading, t]);

  const loadMorePosts = useCallback(() => {
    if (loadingMorePostsRef.current || posts.length >= totalPosts) return;
    const nextPage = page + 1;
    const params = feedParams(nextPage);
    if (!params) return;
    const seq = feedSeq.current;
    loadingMorePostsRef.current = true;
    setLoadingMorePosts(true);
    api
      .getFeed(params)
      .then((feed) => {
        if (seq !== feedSeq.current) return;
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const fresh = feed.items.filter((p) => !seen.has(p.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        setTotalPosts(feed.total);
        setPage(nextPage);
      })
      .catch(() => {})
      .finally(() => {
        loadingMorePostsRef.current = false;
        setLoadingMorePosts(false);
      });
  }, [feedParams, page, posts, totalPosts]);

  // Recarrega ao focar a tela e sempre que a visualização/preferências mudam
  // (reflete novos posts, curtidas e comentários).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Antes de revelar o feed, resolve a localização e escolhe a visualização
  // inicial. Se o bairro atual for o cadastrado, abre "Meu bairro"; nos
  // demais casos (inclusive sem bairro cadastrado), abre "Perto de mim".
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (requestedView === 'meu') {
        setViewMode('meu');
        indicator.set(0);
        setInitialViewLoading(false);
        return;
      }

      setLocError(null);
      setLocLoading(true);
      try {
        const coords = await getDeviceCoords();
        const res = await api.resolveNeighborhood(coords.latitude, coords.longitude);
        if (cancelled) return;

        setPertoCoords(coords);
        setPertoNeighborhood(res.neighborhood);
        const isHome = !!user?.neighborhood
          && normalizeNeighborhood(res.neighborhood) === normalizeNeighborhood(user.neighborhood);
        setViewMode(isHome ? 'meu' : 'perto');
        indicator.set(isHome ? 0 : 1);
      } catch (e) {
        if (cancelled) return;
        setPertoCoords(null);
        setPertoNeighborhood(null);
        setViewMode('perto');
        indicator.set(1);
        setLocError(
          e instanceof LocationError
            ? e.message
            : t('feed.errors.location'),
        );
      } finally {
        if (!cancelled) {
          setLocLoading(false);
          setInitialViewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // A escolha inicial deve acontecer uma única vez para não trocar a aba
    // escolhida manualmente quando o usuário for atualizado no contexto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeNeighborhood = viewMode === 'meu' ? user?.neighborhood : pertoNeighborhood ?? undefined;

  useEffect(() => {
    getOrCreateAdViewerId()
      .then(setAdViewerId)
      .catch(() => setAdViewerId(undefined))
      .finally(() => setAdViewerReady(true));
  }, []);

  useFocusEffect(
    useCallback(() => {
      const seq = ++adSeq.current;
      if (initialViewLoading || !adViewerReady) return;
      if (viewMode === 'perto' && (!pertoNeighborhood || !pertoCoords)) {
        setFeedAd(null);
        setAdLoading(false);
        return;
      }
      setAdLoading(true);
      adsApi
        .getAd('post', {
          neighborhood: activeNeighborhood ?? undefined,
          city: user?.city,
          viewMode: viewMode === 'meu' ? 'home' : 'nearby',
          category: activeCategory !== 'todos' ? activeCategory : undefined,
          engagement: (user?.interactionsCount ?? 0) >= 5 ? 'active' : undefined,
          viewerId: adViewerId,
          userId: user ? Number(user.id) : undefined,
        })
        .then((ad) => {
          if (seq === adSeq.current) setFeedAd(ad);
        })
        .catch(() => {
          if (seq === adSeq.current) setFeedAd(null);
        })
        .finally(() => {
          if (seq === adSeq.current) setAdLoading(false);
        });
    }, [activeNeighborhood, viewMode, activeCategory, user?.interactionsCount, user?.city, user?.id, adViewerId, adViewerReady, initialViewLoading, pertoCoords, pertoNeighborhood]),
  );

  const handlePostDeleted = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const switchView = useCallback((mode: ViewMode) => {
    if (mode === viewMode) {
      // Retoque na aba "Perto de mim" reobtém a localização.
      if (mode === 'perto') fetchPertoLocation();
      return;
    }
    const dir = mode === 'perto' ? 1 : -1;
    contentX.set(dir * 28);
    contentOpacity.set(0.4);
    contentX.set(withSpring(0, { damping: 20, stiffness: 220, mass: 0.6 }));
    contentOpacity.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }));
    indicator.set(withSpring(mode === 'perto' ? 1 : 0, { damping: 20, stiffness: 220, mass: 0.6 }));
    setViewMode(mode);
    if (mode === 'perto') fetchPertoLocation();
  }, [viewMode, fetchPertoLocation, contentX, contentOpacity, indicator]);

  // Redirecionamento de "Alterar bairro de moradia" (Configurações > Meu
  // endereço): chega aqui com ?view=meu pra cair direto na aba "Meu bairro",
  // que mostra o HomeNeighborhoodSetup assim que o bairro estiver vazio.
  useFocusEffect(
    useCallback(() => {
      if (requestedView === 'meu') {
        switchView('meu');
        router.setParams({ view: undefined });
      }
    }, [requestedView, switchView]),
  );

  const onIncludeNearbyChange = useCallback(
    (value: boolean) => {
      if (viewMode === 'meu') setNearbyMeu(value);
      else setNearbyPerto(value);
      // Persiste a preferência (sobrevive a reload e alimenta o broadcast de
      // post importante no backend) — best-effort, sem bloquear a UI.
      api.updateProfile({ include_nearby: value }).catch(() => {});
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
    opacity: contentOpacity.value,
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
              {mode === 'meu' ? t('feed.myNeighborhood') : t('feed.nearMe')}
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
        <TouchableOpacity
          style={styles.composeAvatarBtn}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.8}
        >
          <Image source={{ uri: user?.avatar }} style={styles.composeAvatar} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.composeFakeInput}
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/publish')}
        >
          <Text style={styles.composePlaceholder}>
            {t('feed.compose')}
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
                    {t(`categories.${cat.key}`)}
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
          <Text style={styles.feedStateText}>{t('feed.findingNeighborhood')}</Text>
        </View>
      );
    }
    if (viewMode === 'perto' && locError) {
      return (
        <View style={styles.feedState}>
          <Ionicons name="location-outline" size={32} color={Colors.textTertiary} />
          <Text style={styles.feedStateText}>{locError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchPertoLocation}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
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
          {error ?? t('feed.empty')}
        </Text>
        {error && (
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // "Meu bairro" ainda não configurado: mostra a configuração (mesmo fluxo do
  // cadastro, com escolha de redondezas) em vez do feed.
  const needsHomeSetup = viewMode === 'meu' && !user?.neighborhood;

  // O slide anima só o conteúdo (posts/setup), não o header nem as abas —
  // por isso o transform vai no `Animated.View` de cada item/conteúdo, nunca
  // num wrapper que também contenha `viewTabsBlock`/`feedHeader`.
  const feedPending = initialViewLoading || locLoading || loading || adLoading;

  const feed = feedPending ? (
    <FlatList
      style={styles.feedFill}
      data={[] as FeedItem[]}
      keyExtractor={(item) => (item.kind === 'post' ? item.post.id : `ad-${item.ad.id}`)}
      renderItem={() => null}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={feedHeader}
      contentContainerStyle={[styles.listContent, styles.loadingListContent]}
      ListEmptyComponent={(
        <View style={styles.initialLoader}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      )}
    />
  ) : needsHomeSetup ? (
    <View style={styles.feedFill}>
      {viewTabsBlock}
      <Animated.View style={[styles.feedFill, contentStyle]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          <HomeNeighborhoodSetup />
        </ScrollView>
      </Animated.View>
    </View>
  ) : (
    <FlatList
      ref={listRef}
      style={styles.feedFill}
      data={feedItems}
      keyExtractor={(item) => (item.kind === 'post' ? item.post.id : `ad-${item.ad.id}`)}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={feedHeader}
      renderItem={({ item }) => (
        <Animated.View style={contentStyle}>
          {item.kind === 'post' ? <PostCard post={item.post} onDeleted={handlePostDeleted} /> : <AdPostCard ad={item.ad} viewerId={adViewerId} viewerUserId={user?.id} />}
        </Animated.View>
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
      ListEmptyComponent={renderEmpty}
      onEndReached={loadMorePosts}
      onEndReachedThreshold={0.6}
      ListFooterComponent={
        loadingMorePosts ? (
          <View style={styles.feedFooterLoading}>
            <ActivityIndicator color={Colors.primary} size="small" />
          </View>
        ) : null
      }
    />
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
  // composeBox usa alignItems:"center" (não stretch), então já fica do
  // tamanho do conteúdo — só falta o borderRadius pro hover não vazar quadrado.
  composeAvatarBtn: { borderRadius: 20 },
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
  loadingListContent: { flexGrow: 1 },
  initialLoader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  feedFooterLoading: { paddingVertical: 20, alignItems: 'center' },
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
