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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { useTheme, useThemeMode, useThemedStyles } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import { CATEGORIES, PostCategory, Post, postListKey } from '../../data/mock';
import { api } from '../../lib/api';
import { adsApi, Ad } from '../../lib/adsApi';
import { useAdImpressionTracking } from '../../lib/useAdImpression';
import { DESKTOP_BREAKPOINT as WIDE, FEED_AD_GAP, FEED_PAGE_SIZE } from '../../constants/config';
import { createAdSpacingState, createAdRotationState, advanceAdSlot } from '../../lib/adSpacing';
import { getOrCreateAdViewerId } from '../../lib/storage';
import { getDeviceCoords, LocationError, Coords } from '../../lib/location';
import { useAuth } from '../../lib/auth';
import { useRegisterScrollToTop } from '../../lib/scrollToTop';
import { getScreenMemory, setScreenMemory } from '../../lib/screenMemory';
import PostCard from '../../components/PostCard';
import AdPostCard from '../../components/AdPostCard';
import LeftSidebar from '../../components/LeftSidebar';
import RightSidebar from '../../components/RightSidebar';
import MobileMenu from '../../components/MobileMenu';
import HomeNeighborhoodSetup from '../../components/HomeNeighborhoodSetup';
import SaleRadiusModal from '../../components/SaleRadiusModal';
import SaleGridCard from '../../components/SaleGridCard';
import DaquiMark from '../../components/DaquiMark';

type FilterKey = 'todos' | PostCategory;
type ViewMode = 'meu' | 'perto';
type FeedItem = { kind: 'post'; post: Post } | { kind: 'ad'; ad: Ad };

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
  const { mode } = useThemeMode();
  const styles = useThemedStyles(makeStyles);
  const { view: requestedView } = useLocalSearchParams<{ view?: string }>();

  const [activeCategory, setActiveCategory] = useState<FilterKey>('todos');
  const [importantOnly, setImportantOnly] = useState(false);
  // Vendas: alcance extra além do bairro (null = padrão, só bairro — ver
  // SaleRadiusModal) e visualização em grade. Reseta ao sair da categoria.
  const [saleRadiusKm, setSaleRadiusKm] = useState<number | null>(null);
  const [saleRadiusModalOpen, setSaleRadiusModalOpen] = useState(false);
  const [saleViewLayout, setSaleViewLayout] = useState<'list' | 'grid'>('list');
  const [saleHideSold, setSaleHideSold] = useState(false);
  useEffect(() => {
    if (activeCategory !== 'venda') {
      setSaleRadiusKm(null);
      setSaleViewLayout('list');
      setSaleHideSold(false);
    }
  }, [activeCategory]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [adViewerId, setAdViewerId] = useState<string | undefined>(undefined);
  const [adViewerReady, setAdViewerReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<FeedItem>>(null);
  const scrollOffsetRef = useRef(getScreenMemory('feed.scrollY', 0));

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

  // Monta os parâmetros de busca do feed pra visualização ativa, ou `null`
  // quando ainda falta pré-requisito (bairro configurado / localização
  // resolvida) — mesma checagem usada tanto na carga inicial quanto no "load
  // more" da rolagem infinita.
  const feedParams = useCallback(
    (pageNum: number) => {
      // Vendas: passa a categoria pro backend (e o raio, se escolhido) em vez
      // do filtro 100% client-side de sempre — necessário pro alcance por
      // raio funcionar com paginação correta (ver SaleRadiusModal).
      const saleParams =
        activeCategory === 'venda'
          ? { category: 'venda', ...(saleRadiusKm ? { saleRadiusKm } : {}) }
          : {};
      if (viewMode === 'meu') {
        if (!user?.neighborhood) return null;
        return {
          includeNearby: nearbyMeu,
          latitude: user?.latitude,
          longitude: user?.longitude,
          page: pageNum,
          pageSize: FEED_PAGE_SIZE,
          ...saleParams,
        };
      }
      if (!pertoNeighborhood || !pertoCoords) return null;
      return {
        neighborhood: pertoNeighborhood,
        latitude: pertoCoords.latitude,
        longitude: pertoCoords.longitude,
        includeNearby: nearbyPerto,
        page: pageNum,
        pageSize: FEED_PAGE_SIZE,
        ...saleParams,
      };
    },
    [viewMode, nearbyMeu, nearbyPerto, pertoCoords, pertoNeighborhood, user, activeCategory, saleRadiusKm],
  );

  const [page, setPage] = useState(1);
  const [totalPosts, setTotalPosts] = useState(0);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  // Sequência da carga atual — invalida uma resposta de "load more" que
  // chegue atrasada depois que o usuário já trocou de visualização/bairro
  // (senão ela apareceria colada num feed que já é de outro contexto).
  const feedSeq = useRef(0);
  const loadingMorePostsRef = useRef(false);
  const noMorePostsRef = useRef(false);

  const load = useCallback(async () => {
    if (initialViewLoading) return;
    const seq = ++feedSeq.current;
    try {
      setLoading(true);
      setError(null);
      noMorePostsRef.current = false;
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
      if (feed.items.length === 0) noMorePostsRef.current = true;
    } catch {
      if (seq !== feedSeq.current) return;
      setError(t('feed.errors.load'));
    } finally {
      if (seq === feedSeq.current) setLoading(false);
    }
  }, [feedParams, initialViewLoading, t]);

  const loadMorePosts = useCallback(() => {
    if (loadingMorePostsRef.current || noMorePostsRef.current || posts.length >= totalPosts) return;
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
        // Uma página vazia é o único sinal confiável de "acabou": `total` conta
        // reposts como itens distintos (mesmo `id` do post original), então
        // `posts.length` (deduplicado por postListKey) pode nunca alcançar
        // `totalPosts` mesmo depois de esgotar as páginas — sem essa guarda,
        // loadMorePosts fica reativando por sempre (flicker no fim do feed).
        if (feed.items.length === 0) {
          noMorePostsRef.current = true;
        }
        setPosts((prev) => {
          const seen = new Set(prev.map(postListKey));
          const fresh = feed.items.filter((p) => !seen.has(postListKey(p)));
          if (fresh.length === 0) noMorePostsRef.current = true;
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

  const loadedContext = useRef<string | null>(null);
  const feedContext = JSON.stringify({
    ready: !initialViewLoading,
    viewMode,
    nearbyMeu,
    nearbyPerto,
    pertoNeighborhood,
    pertoCoords,
    home: user?.neighborhood,
    latitude: user?.latitude,
    longitude: user?.longitude,
    // Só relevante quando a categoria ativa é Vendas — recarrega do backend
    // ao entrar/sair da categoria ou trocar o raio (ver feedParams acima).
    sale: activeCategory === 'venda' ? saleRadiusKm ?? 'default' : null,
  });

  // Recarrega apenas quando os parâmetros reais mudam. Um simples retorno à
  // seção mantém os itens e o offset em vez de reconstruir a FlatList.
  useFocusEffect(
    useCallback(() => {
      if (loadedContext.current === feedContext) return;
      loadedContext.current = feedContext;
      load();
    }, [feedContext, load]),
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
  // Referência de distância do grid de Vendas (ver SaleGridCard) — mesmas
  // coordenadas usadas pela visualização ativa do feed.
  const activeReferenceCoords: Coords | null =
    viewMode === 'meu'
      ? user?.latitude != null && user?.longitude != null
        ? { latitude: user.latitude, longitude: user.longitude }
        : null
      : pertoCoords;

  useEffect(() => {
    getOrCreateAdViewerId()
      .then(setAdViewerId)
      .catch(() => setAdViewerId(undefined))
      .finally(() => setAdViewerReady(true));
  }, []);

  // A inserção de anúncios no feed (espaçamento variável + rotação) fica no
  // efeito abaixo de `filteredPosts` — ver lib/adSpacing.ts.

  const handlePostDeleted = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const switchView = useCallback((mode: ViewMode) => {
    if (mode === viewMode) {
      // Retoque na aba já ativa atualiza: "Perto de mim" reobtém a
      // localização, "Meu bairro" só recarrega o feed (bairro já é o
      // cadastrado, não depende de GPS).
      if (mode === 'perto') fetchPertoLocation();
      else load();
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
  }, [viewMode, fetchPertoLocation, load, contentX, contentOpacity, indicator]);

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
    if (refreshing) return;
    setRefreshing(true);
    if (viewMode === 'perto') await fetchPertoLocation();
    await load();
    setRefreshing(false);
  }, [refreshing, viewMode, fetchPertoLocation, load]);

  useRegisterScrollToTop('index', () => {
    // Primeiro toque fora do topo apenas volta ao início. Um novo toque, já
    // no início, passa a funcionar como atualização explícita no desktop.
    if (scrollOffsetRef.current > 8) {
      scrollOffsetRef.current = 0;
      setScreenMemory('feed.scrollY', 0);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      return;
    }
    void onRefresh();
  });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentX.value }],
    opacity: contentOpacity.value,
  }));
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicator.value * (tabsWidth / 2) }],
  }));

  const filteredPosts = useMemo(
    () =>
      posts.filter(
        (p) =>
          (activeCategory === 'todos' || p.category === activeCategory) &&
          (!importantOnly || p.important) &&
          (activeCategory !== 'venda' || !saleHideSold || p.resolvedStatus !== 'sold'),
      ),
    [posts, activeCategory, importantOnly, saleHideSold],
  );

  // Espaçamento variável + rotação de anúncios (ver lib/adSpacing.ts) — o
  // estado (quantos posts orgânicos desde o último anúncio, qual foi o
  // último anúncio mostrado) fica num ref pra sobreviver entre execuções
  // deste efeito sem virar dependência dele.
  const feedSpacingRef = useRef({
    scan: createAdSpacingState(FEED_AD_GAP),
    rotation: createAdRotationState(),
    builtIds: [] as string[],
  });
  const feedSpacingSeq = useRef(0);

  useEffect(() => {
    if (!adViewerReady) return;
    const spacing = feedSpacingRef.current;
    const newIds = filteredPosts.map(postListKey);
    // "Append" = os ids atuais começam exatamente pelos já processados (ex.:
    // `loadMorePosts` colou mais posts no fim) — preserva o espaçamento e a
    // rotação em andamento. Qualquer outra mudança (refresh, troca de bairro/
    // "meu"-"perto", filtro de categoria/importantes) é tratada como uma
    // visão nova do feed e reinicia os dois.
    const isAppend =
      newIds.length >= spacing.builtIds.length && spacing.builtIds.every((id, i) => newIds[i] === id);
    const startIndex = isAppend ? spacing.builtIds.length : 0;
    if (!isAppend) {
      spacing.scan = createAdSpacingState(FEED_AD_GAP);
      spacing.rotation = createAdRotationState();
      setFeedItems([]);
    }
    const toProcess = filteredPosts.slice(startIndex);
    spacing.builtIds = newIds;
    if (toProcess.length === 0) return;

    const seq = ++feedSpacingSeq.current;
    (async () => {
      const appended: FeedItem[] = [];
      for (const post of toProcess) {
        appended.push({ kind: 'post', post });
        const ad = await advanceAdSlot(spacing.scan, FEED_AD_GAP, spacing.rotation, (excludeIds) =>
          adsApi.getAds('post', {
            neighborhood: activeNeighborhood ?? undefined,
            city: user?.city,
            viewMode: viewMode === 'meu' ? 'home' : 'nearby',
            category: activeCategory !== 'todos' ? activeCategory : undefined,
            engagement: (user?.interactionsCount ?? 0) >= 5 ? 'active' : undefined,
            viewerId: adViewerId,
            excludeIds,
            limit: 1,
          }),
        );
        // Uma visão nova começou no meio deste processamento (ex.: usuário
        // trocou de bairro enquanto a busca do anúncio ainda estava no ar) —
        // descarta este lote, o próximo disparo do efeito já reconstrói do zero.
        if (seq !== feedSpacingSeq.current) return;
        if (ad) appended.push({ kind: 'ad', ad });
      }
      setFeedItems((prev) => (isAppend ? [...prev, ...appended] : appended));
    })();
  }, [filteredPosts, adViewerReady, adViewerId, activeNeighborhood, viewMode, activeCategory, user?.city, user?.interactionsCount]);

  const { onViewableItemsChanged: onAdViewableItemsChanged, viewabilityConfig: adViewabilityConfig } =
    useAdImpressionTracking<FeedItem>(
      'post',
      (item) => (item.kind === 'ad' ? item.ad : null),
      { viewerId: adViewerId, neighborhood: activeNeighborhood ?? undefined },
    );

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
          onPress={() => router.navigate('/(tabs)/profile')}
          activeOpacity={0.8}
        >
          <Image source={{ uri: user?.avatar }} style={styles.composeAvatar} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.composeFakeInput}
          activeOpacity={0.7}
          onPress={() => router.navigate('/(tabs)/publish')}
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
                <View key={cat.key} style={styles.mobileTabWrap}>
                  <TouchableOpacity
                    style={[styles.mobileTab, isActive && { borderBottomColor: color }]}
                    onPress={() => setActiveCategory(cat.key as FilterKey)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={cat.icon as any} size={12} color={isActive ? color : Colors.textTertiary} />
                    <Text style={[styles.mobileTabText, isActive && { color, fontWeight: '700' }]}>
                      {t(`categories.${cat.key}`)}
                    </Text>
                  </TouchableOpacity>
                  {cat.key === 'venda' && isActive && (
                    <TouchableOpacity
                      style={styles.saleRadiusBtn}
                      onPress={() => setSaleRadiusModalOpen(true)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="navigate-circle-outline"
                        size={16}
                        color={saleRadiusKm ? Colors.primary : Colors.textTertiary}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {activeCategory === 'venda' && (
        <>
          {/* Deixa explícito se o feed está mostrando só o bairro ou já tem
              um raio extra aplicado — clicável, abre o mesmo SaleRadiusModal
              do botão ao lado da categoria. */}
          <TouchableOpacity
            style={styles.saleScopeRow}
            onPress={() => setSaleRadiusModalOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={saleRadiusKm ? 'navigate-circle-outline' : 'home-outline'}
              size={13}
              color={saleRadiusKm ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.saleScopeText, !!saleRadiusKm && { color: Colors.primary }]}>
              {saleRadiusKm ? t('feed.saleScope.radius', { km: saleRadiusKm }) : t('feed.saleScope.neighborhood')}
            </Text>
            <Ionicons name="chevron-forward" size={12} color={Colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.saleViewToggleRow}>
            <TouchableOpacity
              style={styles.saleHideSoldRow}
              onPress={() => setSaleHideSold((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, saleHideSold && styles.checkboxChecked]}>
                {saleHideSold && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={styles.saleHideSoldText}>{t('feed.saleHideSold')}</Text>
            </TouchableOpacity>
            <View style={styles.saleViewToggleGroup}>
              {(['list', 'grid'] as const).map((layout) => {
                const active = saleViewLayout === layout;
                return (
                  <TouchableOpacity
                    key={layout}
                    style={[styles.saleViewToggleBtn, active && styles.saleViewToggleBtnActive]}
                    onPress={() => setSaleViewLayout(layout)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={layout === 'list' ? 'list-outline' : 'grid-outline'}
                      size={14}
                      color={active ? Colors.primary : Colors.textTertiary}
                    />
                    <Text style={[styles.saleViewToggleText, active && { color: Colors.primary }]}>
                      {t(`feed.saleView.${layout}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </>
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
  const feedPending = initialViewLoading || locLoading || loading;

  const feed = feedPending ? (
    <FlatList
      key="feed-loading"
      style={styles.feedFill}
      data={[] as FeedItem[]}
      keyExtractor={(item) => (item.kind === 'post' ? postListKey(item.post) : `ad-${item.ad.id}`)}
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
  ) : activeCategory === 'venda' && saleViewLayout === 'grid' ? (
    <FlatList
      key={`feed-grid-${isWide}`}
      style={styles.feedFill}
      data={filteredPosts}
      keyExtractor={postListKey}
      numColumns={isWide ? 3 : 2}
      columnWrapperStyle={styles.gridRow}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={feedHeader}
      renderItem={({ item }) => (
        <View style={styles.gridItem}>
          <SaleGridCard post={item} referenceCoords={activeReferenceCoords} />
        </View>
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
  ) : (
    <FlatList
      key="feed-list"
      ref={listRef}
      style={styles.feedFill}
      data={feedItems}
      keyExtractor={(item, index) => (item.kind === 'post' ? postListKey(item.post) : `ad-${item.ad.id}-${index}`)}
      showsVerticalScrollIndicator={false}
      onScroll={(event) => {
        const y = Math.max(0, event.nativeEvent.contentOffset.y);
        scrollOffsetRef.current = y;
        setScreenMemory('feed.scrollY', y);
      }}
      scrollEventThrottle={100}
      onContentSizeChange={() => {
        const y = getScreenMemory('feed.scrollY', 0);
        if (y > 0) listRef.current?.scrollToOffset({ offset: y, animated: false });
      }}
      onViewableItemsChanged={onAdViewableItemsChanged}
      viewabilityConfig={adViewabilityConfig}
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
              saleRadiusKm={saleRadiusKm}
              onOpenSaleRadius={() => setSaleRadiusModalOpen(true)}
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
            <View accessible accessibilityRole="image" accessibilityLabel="Daqui" style={styles.mobileLogo}>
              <DaquiMark size={28} color={mode === 'dark' ? '#FFFFFF' : Colors.primaryDark} />
            </View>
            <MobileMenu
              inline
              activeCategory={activeCategory}
              onCategoryChange={(k) => setActiveCategory(k as FilterKey)}
              importantOnly={importantOnly}
              onImportantChange={setImportantOnly}
              includeNearby={nearbyActive}
              onIncludeNearbyChange={onIncludeNearbyChange}
              saleRadiusKm={saleRadiusKm}
              onOpenSaleRadius={() => setSaleRadiusModalOpen(true)}
            />
          </View>
          {feed}
        </View>
      )}

      <SaleRadiusModal
        visible={saleRadiusModalOpen}
        onClose={() => setSaleRadiusModalOpen(false)}
        referenceLabel={viewMode === 'meu' ? t('feed.myNeighborhood') : t('feed.nearMe')}
        radiusKm={saleRadiusKm}
        onApply={(km) => {
          setSaleRadiusKm(km);
          setSaleRadiusModalOpen(false);
        }}
      />
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
  mobileLogo: { height: 28, justifyContent: 'center' },

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
  mobileTabWrap: { flexDirection: 'row', alignItems: 'center' },
  // borderRadius direto no próprio Touchable (não no pai/filho) — senão o
  // hover global (globalStyles.web.ts) desenha o realce com cantos quadrados
  // em cima de um botão que devia parecer redondo (ver memória do bug).
  saleRadiusBtn: { padding: 6, borderRadius: 14, marginLeft: 2 },
  saleViewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  // Mesmo motivo do saleRadiusBtn acima: borderRadius direto aqui, não só no
  // checkbox filho, senão o hover do row inteiro sai com cantos quadrados.
  saleHideSoldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: -6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  saleHideSoldText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  saleScopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginHorizontal: 10,
    marginTop: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  saleScopeText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  checkbox: {
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  saleViewToggleGroup: { flexDirection: 'row', gap: 8 },
  saleViewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.background,
  },
  saleViewToggleBtnActive: { backgroundColor: Colors.primaryFaint },
  saleViewToggleText: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary },
  gridRow: { gap: 10, paddingHorizontal: 14 },
  gridItem: { flex: 1, marginBottom: 10 },
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
