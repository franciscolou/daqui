import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { NOTIF_ICONS } from '../../constants/notifications';
import { notificationParts } from '../../components/NotificationText';
import RemovedContentModal from '../../components/RemovedContentModal';
import { api, AppNotification } from '../../lib/api';
import { adsApi, Ad } from '../../lib/adsApi';
import { useAdImpressionTracking } from '../../lib/useAdImpression';
import { FEED_AD_GAP, createAdSpacingState, createAdRotationState, advanceAdSlot } from '../../lib/adSpacing';
import { getOrCreateAdViewerId } from '../../lib/storage';
import { useAuth } from '../../lib/auth';
import { useRealtime } from '../../lib/realtime';
import { useRegisterScrollToTop } from '../../lib/scrollToTop';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import { formatNotificationTime } from '../../lib/time';
import FeedLayout from '../../components/FeedLayout';
import MobileMenu from '../../components/MobileMenu';

const WIDE = 900;
const REMOVED_TYPES = new Set(['post_removed', 'comment_removed']);

// Notificação sintética pro slot de anúncio (ver lib/adSpacing.ts) — `ad`
// embutido, diferente de AppNotification, é o que permite mais de uma
// ocorrência (possivelmente do mesmo anúncio) na mesma lista sem depender de
// um único estado externo.
interface AdNotificationItem {
  id: string;
  type: 'ad';
  content: string;
  time: string;
  read: true;
  ad: Ad;
}
type DisplayNotification = AppNotification | AdNotificationItem;

export default function NotificationsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { subscribeNotifications } = useRealtime();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [displayNotifications, setDisplayNotifications] = useState<DisplayNotification[]>([]);
  const [adViewerId, setAdViewerId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removedPreview, setRemovedPreview] = useState<AppNotification | null>(null);
  const listRef = useRef<FlatList<DisplayNotification>>(null);
  // Rotação (último anúncio mostrado) sobrevive a recargas da lista — a lista
  // inteira é refeita a cada `load()` (sem paginação aqui), mas não repetir o
  // mesmo anúncio deve valer além de uma única recarga.
  const notifRotationRef = useRef(createAdRotationState());
  const notifSpacingSeq = useRef(0);

  const load = useCallback(() => {
    return api.getNotifications()
      .then((items) => {
        setNotifications(items);
        if (items.some((n) => !n.read)) api.markNotificationsRead().catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    getOrCreateAdViewerId().then(setAdViewerId);
  }, []);

  // Reconta "5m atrás" etc. em tempo real enquanto a tela fica aberta, sem refetch.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((v) => v + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Espaçamento variável + rotação (ver lib/adSpacing.ts) — sem paginação
  // aqui, então cada `load()` refaz a lista inteira do zero (a rotação em si,
  // acima em `notifRotationRef`, sobrevive à recarga).
  useEffect(() => {
    const seq = ++notifSpacingSeq.current;
    const scan = createAdSpacingState(FEED_AD_GAP);
    let occurrence = 0;
    (async () => {
      const items: DisplayNotification[] = [];
      for (const n of notifications) {
        items.push(n);
        const ad = await advanceAdSlot(scan, FEED_AD_GAP, notifRotationRef.current, (excludeIds) =>
          adsApi.getAds('notification', {
            neighborhood: user?.neighborhood,
            city: user?.city,
            engagement: (user?.interactionsCount ?? 0) >= 5 ? 'active' : undefined,
            viewerId: adViewerId,
            excludeIds,
            limit: 1,
          }),
        );
        if (seq !== notifSpacingSeq.current) return;
        if (ad) {
          items.push({
            id: `ad-${ad.id}-${occurrence++}`,
            type: 'ad',
            content: ad.title,
            time: t('notifications.sponsored'),
            read: true,
            ad,
          });
        }
      }
      setDisplayNotifications(items);
    })();
  }, [notifications, user?.neighborhood, user?.city, user?.interactionsCount, adViewerId, t]);

  const { onViewableItemsChanged: onAdViewableItemsChanged, viewabilityConfig: adViewabilityConfig } =
    useAdImpressionTracking<DisplayNotification>(
      'notification',
      (item) => ('ad' in item ? item.ad : null),
      { viewerId: adViewerId, neighborhood: user?.neighborhood },
    );

  // Recarrega ao vivo quando o servidor avisa (via websocket) que chegou algo novo —
  // só enquanto a tela está em foco: o navigator mantém esta tela montada em segundo
  // plano depois da primeira visita, e um useEffect comum aqui dispararia load() (que
  // marca como lida) por notificações que chegaram sem o usuário ter entrado na aba,
  // fazendo o indicador da barra sumir cedo demais.
  useFocusEffect(useCallback(() => subscribeNotifications(load), [subscribeNotifications, load]));

  useRegisterScrollToTop('notifications', () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <FeedLayout showMobileMenu={false}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTexts}>
            <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
            <Text style={styles.headerSub}>{t('notifications.subtitle')}</Text>
          </View>
          {!isWide && <MobileMenu inline />}
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={displayNotifications}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onAdViewableItemsChanged}
        viewabilityConfig={adViewabilityConfig}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="notifications-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>{t('notifications.emptyTitle')}</Text>
              <Text style={styles.emptyDesc}>{t('notifications.emptyDesc')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          // `'ad' in item` (em vez de `item.type === 'ad'`) é o jeito correto
          // de estreitar a união aqui: `AppNotification.type` é `string` (não
          // um literal), então TS não consegue descartar esse ramo só pela
          // comparação de `type`.
          if ('ad' in item) {
            const { ad } = item;
            const style = NOTIF_ICONS.ad;
            const onPress = () => {
              adsApi.trackAdClick(ad.id, { viewerId: adViewerId, creativeId: ad.creativeId, format: 'notification' });
              Linking.openURL(ad.targetUrl);
            };
            return (
              <TouchableOpacity style={styles.notifRow} activeOpacity={0.85} onPress={onPress}>
                {ad.imageUrl ? (
                  <View style={styles.notifAvatarWrapper}>
                    <Image source={{ uri: ad.imageUrl }} style={styles.notifAvatar} />
                    <View style={[styles.notifTypeBadge, { backgroundColor: style.bg }]}>
                      <Ionicons name={style.icon as any} size={10} color={style.color} />
                    </View>
                  </View>
                ) : (
                  <View style={[styles.notifIconBox, { backgroundColor: style.bg }]}>
                    <Ionicons name={style.icon as any} size={20} color={style.color} />
                  </View>
                )}
                <View style={styles.notifContent}>
                  <Text style={styles.notifText}>{notificationParts(item, styles.notifBold, t)}</Text>
                  <Text style={styles.notifTime}>{item.time}</Text>
                </View>
              </TouchableOpacity>
            );
          }
          const style = NOTIF_ICONS[item.type] ?? NOTIF_ICONS.welcome;
          const onPress = () => {
            if (REMOVED_TYPES.has(item.type) && item.snapshot) setRemovedPreview(item);
            else if (item.type === 'welcome') router.push('/help');
            else if (item.postId) router.push(`/post/${item.postId}` as any);
            else if (item.actor) router.push(`/user/${item.actor.id}` as any);
          };
          return (
            <TouchableOpacity
              style={[styles.notifRow, !item.read && styles.notifRowUnread]}
              activeOpacity={0.85}
              onPress={onPress}
            >
              {item.actor ? (
                <View style={styles.notifAvatarWrapper}>
                  <Image source={{ uri: item.actor.avatar }} style={styles.notifAvatar} />
                  <View style={[styles.notifTypeBadge, { backgroundColor: style.bg }]}>
                    <Ionicons name={style.icon as any} size={10} color={style.color} />
                  </View>
                </View>
              ) : (
                <View style={[styles.notifIconBox, { backgroundColor: style.bg }]}>
                  <Ionicons name={style.icon as any} size={20} color={style.color} />
                </View>
              )}
              <View style={styles.notifContent}>
                <Text style={[styles.notifText, !item.read && styles.notifTextUnread]}>
                  {notificationParts(item, styles.notifBold, t)}
                </Text>
                <Text style={styles.notifTime}>{formatNotificationTime(item.time)}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        }}
      />
      <RemovedContentModal notification={removedPreview} onClose={() => setRemovedPreview(null)} />
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
  headerTexts: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: Colors.textTertiary },
  separator: { height: 1, backgroundColor: Colors.borderLight },
  loader: { marginTop: 60 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptyDesc: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', maxWidth: 240 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: Colors.surface,
  },
  notifRowUnread: { backgroundColor: Colors.primaryFaint },
  notifAvatarWrapper: { position: 'relative' },
  notifAvatar: { width: 48, height: 48, borderRadius: 14 },
  notifTypeBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  notifIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: { flex: 1 },
  notifText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  notifTextUnread: { color: Colors.text, fontWeight: '600' },
  notifBold: { fontWeight: '800', color: Colors.text },
  notifTime: { fontSize: 12, color: Colors.textTertiary, marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
});
