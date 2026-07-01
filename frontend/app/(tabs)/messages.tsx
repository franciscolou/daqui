import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { api, Conversation } from '../../lib/api';
import { formatConversationTime } from '../../lib/time';
import FeedLayout from '../../components/FeedLayout';

export default function MessagesScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.getConversations()
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Recarrega ao focar (reflete mensagens enviadas/recebidas)
  useFocusEffect(load);

  const filteredMessages = conversations.filter((c) =>
    search === '' || c.user.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <FeedLayout>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mensagens</Text>
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
        keyExtractor={(item) => item.user.id}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <MessageRow conversation={item} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Nenhuma conversa</Text>
              <Text style={styles.emptyDesc}>Suas mensagens com vizinhos aparecerão aqui</Text>
            </View>
          )
        }
      />
    </FeedLayout>
  );
}

function MessageRow({ conversation }: { conversation: Conversation }) {
  const styles = useThemedStyles(makeStyles);
  const { user, lastMessage, time, unread } = conversation;
  return (
    <TouchableOpacity
      style={styles.msgRow}
      activeOpacity={0.85}
      onPress={() => router.push(`/messages/${user.id}` as any)}
    >
      <View style={styles.msgAvatarWrapper}>
        <Image source={{ uri: user.avatar }} style={styles.msgAvatar} />
      </View>
      <View style={styles.msgContent}>
        <View style={styles.msgHeader}>
          <Text style={[styles.msgName, unread > 0 && styles.msgNameBold]}>{user.name}</Text>
          <Text style={[styles.msgTime, unread > 0 && styles.msgTimeBold]}>{formatConversationTime(time)}</Text>
        </View>
        <View style={styles.msgFooter}>
          <Text
            style={[styles.msgPreview, unread > 0 && styles.msgPreviewBold]}
            numberOfLines={1}
          >
            {lastMessage}
          </Text>
          {unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, outlineStyle: 'none' } as any,
  separator: { height: 1, backgroundColor: Colors.borderLight },
  loader: { marginTop: 60 },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: Colors.surface,
  },
  msgAvatarWrapper: { position: 'relative' },
  msgAvatar: { width: 52, height: 52, borderRadius: 16 },
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
});
