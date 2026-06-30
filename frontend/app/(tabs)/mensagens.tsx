import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Colors } from '../../constants/Colors';
import { MESSAGES, NOTIFICATIONS, Message } from '../../data/mock';

type TabKey = 'mensagens' | 'notificacoes';

const NOTIF_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  like: { icon: 'heart', bg: '#FEE2E2', color: Colors.error },
  comment: { icon: 'chatbubble', bg: Colors.indigoLight, color: Colors.indigo },
  alert: { icon: 'alert-circle', bg: '#FEE2E2', color: Colors.error },
  event: { icon: 'calendar', bg: '#F3E8FF', color: '#9333EA' },
  mention: { icon: 'at', bg: Colors.primaryFaint, color: Colors.primary },
  welcome: { icon: 'sparkles', bg: Colors.accentLight, color: Colors.accent },
};

export default function MensagensScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('mensagens');
  const [search, setSearch] = useState('');

  const filteredMessages = MESSAGES.filter((m) =>
    search === '' || m.user.name.toLowerCase().includes(search.toLowerCase())
  );

  const unreadCount = MESSAGES.reduce((sum, m) => sum + m.unread, 0);
  const unreadNotifs = NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#0D2918', '#15803D']} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Caixa de entrada</Text>
          <TouchableOpacity style={styles.newMsgBtn}>
            <Ionicons name="create-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'mensagens' && styles.tabActive]}
            onPress={() => setActiveTab('mensagens')}
          >
            <Text style={[styles.tabText, activeTab === 'mensagens' && styles.tabTextActive]}>
              Mensagens
            </Text>
            {unreadCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'notificacoes' && styles.tabActive]}
            onPress={() => setActiveTab('notificacoes')}
          >
            <Text style={[styles.tabText, activeTab === 'notificacoes' && styles.tabTextActive]}>
              Notificações
            </Text>
            {unreadNotifs > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadNotifs}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {activeTab === 'mensagens' ? (
        <>
          {/* Search */}
          <View style={styles.searchWrapper}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={17} color={Colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar conversa..."
                placeholderTextColor={Colors.textTertiary}
                value={search}
                onChangeText={setSearch}
              />
            </View>
          </View>

          <FlatList
            data={filteredMessages}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => <MessageRow message={item} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={48} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>Nenhuma conversa</Text>
                <Text style={styles.emptyDesc}>Suas mensagens com vizinhos aparecerão aqui</Text>
              </View>
            }
          />
        </>
      ) : (
        <FlatList
          data={NOTIFICATIONS}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const style = NOTIF_ICONS[item.type] ?? NOTIF_ICONS.welcome;
            return (
              <TouchableOpacity
                style={[styles.notifRow, !item.read && styles.notifRowUnread]}
                activeOpacity={0.85}
              >
                {item.user ? (
                  <View style={styles.notifAvatarWrapper}>
                    <Image source={{ uri: item.user.avatar }} style={styles.notifAvatar} />
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
                    {item.content}
                  </Text>
                  <Text style={styles.notifTime}>{item.time} atrás</Text>
                </View>
                {!item.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function MessageRow({ message }: { message: Message }) {
  return (
    <TouchableOpacity style={styles.msgRow} activeOpacity={0.85}>
      <View style={styles.msgAvatarWrapper}>
        <Image source={{ uri: message.user.avatar }} style={styles.msgAvatar} />
        {message.online && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.msgContent}>
        <View style={styles.msgHeader}>
          <Text style={[styles.msgName, message.unread > 0 && styles.msgNameBold]}>
            {message.user.name}
          </Text>
          <Text style={[styles.msgTime, message.unread > 0 && styles.msgTimeBold]}>
            {message.time}
          </Text>
        </View>
        <View style={styles.msgFooter}>
          <Text
            style={[styles.msgPreview, message.unread > 0 && styles.msgPreviewBold]}
            numberOfLines={1}
          >
            {message.lastMessage}
          </Text>
          {message.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{message.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  newMsgBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 0,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#fff' },
  tabText: { fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  tabBadge: {
    backgroundColor: Colors.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  separator: { height: 1, backgroundColor: Colors.borderLight },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: Colors.surface,
  },
  msgAvatarWrapper: { position: 'relative' },
  msgAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  msgContent: { flex: 1 },
  msgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  msgName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  msgNameBold: { fontWeight: '800' },
  msgTime: { fontSize: 12, color: Colors.textTertiary },
  msgTimeBold: { color: Colors.primary, fontWeight: '700' },
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  msgPreview: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  msgPreviewBold: { color: Colors.text, fontWeight: '600' },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
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
  notifTime: { fontSize: 12, color: Colors.textTertiary, marginTop: 3 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
});
