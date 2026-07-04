import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { NOTIF_ICONS } from '../../constants/notifications';
import { notificationParts } from '../../components/NotificationText';
import RemovedContentModal from '../../components/RemovedContentModal';
import { api, AppNotification } from '../../lib/api';
import { useRealtime } from '../../lib/realtime';
import { useTheme, useThemedStyles } from '../../lib/theme';
import FeedLayout from '../../components/FeedLayout';
import MobileMenu from '../../components/MobileMenu';

const WIDE = 900;
const REMOVED_TYPES = new Set(['post_removed', 'comment_removed']);

export default function NotificationsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { subscribeNotifications } = useRealtime();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [removedPreview, setRemovedPreview] = useState<AppNotification | null>(null);

  const load = useCallback(() => {
    api.getNotifications()
      .then((items) => {
        setNotifications(items);
        if (items.some((n) => !n.read)) api.markNotificationsRead().catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  // Recarrega ao vivo quando o servidor avisa (via websocket) que chegou algo novo.
  useEffect(() => subscribeNotifications(load), [subscribeNotifications, load]);

  return (
    <FeedLayout showMobileMenu={false}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTexts}>
            <Text style={styles.headerTitle}>Novidades</Text>
            <Text style={styles.headerSub}>Curtidas, comentários e avisos do seu bairro</Text>
          </View>
          {!isWide && <MobileMenu inline />}
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="notifications-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Tudo em dia</Text>
              <Text style={styles.emptyDesc}>Você não tem novidades no momento</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const style = NOTIF_ICONS[item.type] ?? NOTIF_ICONS.welcome;
          const onPress = () => {
            if (REMOVED_TYPES.has(item.type) && item.snapshot) setRemovedPreview(item);
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
                  {notificationParts(item, styles.notifBold)}
                </Text>
                <Text style={styles.notifTime}>{item.time}</Text>
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
