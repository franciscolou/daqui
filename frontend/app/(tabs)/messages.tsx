import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { useTheme, useThemedStyles } from '../../lib/theme';
import MobileMenu from '../../components/MobileMenu';
import {
  api,
  Conversation,
  Group,
  GroupConversation,
  MessageResult,
} from '../../lib/api';
import { formatConversationTime, formatPostTime } from '../../lib/time';
import FeedLayout from '../../components/FeedLayout';

// Item unificado da caixa de entrada: conversa 1:1 (dm) ou grupo.
type InboxItem =
  | { kind: 'dm'; key: string; time: string; conversation: Conversation }
  | { kind: 'group'; key: string; time: string; conversation: GroupConversation };

type SearchTab = 'yours' | 'discover';

export default function MessagesScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<SearchTab>('yours');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgResults, setMsgResults] = useState<MessageResult[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [discovered, setDiscovered] = useState<Group[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const load = useCallback(() => {
    Promise.all([
      api.getConversations().catch(() => [] as Conversation[]),
      api.getGroupConversations().catch(() => [] as GroupConversation[]),
    ])
      .then(([dms, gs]) => {
        setConversations(dms);
        setGroups(gs);
      })
      .finally(() => setLoading(false));
  }, []);

  // Recarrega ao focar (reflete mensagens enviadas/recebidas e grupos criados)
  useFocusEffect(load);

  // Caixa de entrada unificada, ordenada pela última atividade.
  const inbox = useMemo<InboxItem[]>(() => {
    const items: InboxItem[] = [
      ...conversations.map((c): InboxItem => ({
        kind: 'dm',
        key: `u${c.user.id}`,
        time: c.time,
        conversation: c,
      })),
      ...groups.map((g): InboxItem => ({
        kind: 'group',
        key: `g${g.group.id}`,
        time: g.time,
        conversation: g,
      })),
    ];
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [conversations, groups]);

  const searching = search.trim() !== '';

  // Filtro por nome (conversas + grupos) na aba "Suas conversas".
  const filteredInbox = useMemo(() => {
    if (!searching) return inbox;
    const q = search.toLowerCase();
    return inbox.filter((it) =>
      it.kind === 'dm'
        ? it.conversation.user.name.toLowerCase().includes(q)
        : it.conversation.group.name.toLowerCase().includes(q),
    );
  }, [inbox, searching, search]);

  const runSearch = (term: string) => {
    const id = ++seq.current;
    setMsgLoading(true);
    setDiscoverLoading(true);
    api
      .searchMessages(term)
      .then((r) => id === seq.current && setMsgResults(r))
      .catch(() => id === seq.current && setMsgResults([]))
      .finally(() => id === seq.current && setMsgLoading(false));
    api
      .discoverGroups(term)
      .then((r) => id === seq.current && setDiscovered(r))
      .catch(() => id === seq.current && setDiscovered([]))
      .finally(() => id === seq.current && setDiscoverLoading(false));
  };

  const onChangeSearch = (v: string) => {
    setSearch(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim() === '') {
      seq.current++; // cancela buscas pendentes
      setMsgResults([]);
      setDiscovered([]);
      setMsgLoading(false);
      setDiscoverLoading(false);
      return;
    }
    timer.current = setTimeout(() => runSearch(v.trim()), 300);
  };

  return (
    <FeedLayout showMobileMenu={false}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Mensagens</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.newGroupBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/groups/new' as any)}
            >
              <Ionicons name="people" size={16} color="#fff" />
              <Text style={styles.newGroupText}>Novo grupo</Text>
            </TouchableOpacity>
            {!isWide && <MobileMenu inline />}
          </View>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar conversa, mensagem ou grupo..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={onChangeSearch}
          />
        </View>
        {searching && (
          <View style={styles.tabs}>
            <TabButton label="Suas conversas" active={tab === 'yours'} onPress={() => setTab('yours')} />
            <TabButton label="Descobrir" active={tab === 'discover'} onPress={() => setTab('discover')} />
          </View>
        )}
      </View>

      {searching && tab === 'discover' ? (
        <DiscoverList groups={discovered} loading={discoverLoading} onChanged={load} />
      ) : (
        <FlatList
          data={filteredInbox}
          keyExtractor={(item) => item.key}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => <InboxRow item={item} />}
          ListFooterComponent={
            searching ? (
              <MessageSearchResults
                results={msgResults}
                loading={msgLoading}
                nothingElse={filteredInbox.length === 0}
              />
            ) : null
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={Colors.primary} style={styles.loader} />
            ) : searching ? null : (
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={48} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>Nenhuma conversa</Text>
                <Text style={styles.emptyDesc}>
                  Suas mensagens e grupos com vizinhos aparecerão aqui
                </Text>
              </View>
            )
          }
        />
      )}
    </FeedLayout>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const isGroup = item.kind === 'group';
  const name = isGroup ? item.conversation.group.name : item.conversation.user.name;
  const avatar = isGroup ? item.conversation.group.avatar : item.conversation.user.avatar;
  const { lastMessage, unread } = item.conversation;

  return (
    <TouchableOpacity
      style={styles.msgRow}
      activeOpacity={0.85}
      onPress={() =>
        router.push(
          (isGroup
            ? `/groups/${item.conversation.group.id}`
            : `/messages/${item.conversation.user.id}`) as any,
        )
      }
    >
      <View style={styles.msgAvatarWrapper}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.msgAvatar} />
        ) : (
          <View style={[styles.msgAvatar, styles.groupAvatar]}>
            <Ionicons name="people" size={24} color={Colors.primary} />
          </View>
        )}
      </View>
      <View style={styles.msgContent}>
        <View style={styles.msgHeader}>
          <View style={styles.nameRow}>
            {isGroup && <Ionicons name="people" size={13} color={Colors.textTertiary} />}
            <Text style={[styles.msgName, unread > 0 && styles.msgNameBold]} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <Text style={[styles.msgTime, unread > 0 && styles.msgTimeBold]}>
            {formatConversationTime(item.time)}
          </Text>
        </View>
        <View style={styles.msgFooter}>
          <Text style={[styles.msgPreview, unread > 0 && styles.msgPreviewBold]} numberOfLines={1}>
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

function DiscoverList({
  groups,
  loading,
  onChanged,
}: {
  groups: Group[];
  loading: boolean;
  onChanged: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const [joining, setJoining] = useState<string | null>(null);

  const join = async (g: Group) => {
    setJoining(g.id);
    try {
      await api.joinGroup(g.id);
      onChanged();
      router.push(`/groups/${g.id}` as any);
    } catch {
      setJoining(null);
    }
  };

  if (loading) {
    return <ActivityIndicator color={Colors.primary} style={styles.loader} />;
  }
  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="compass-outline" size={44} color={Colors.textTertiary} />
        <Text style={styles.emptyDesc}>Nenhum grupo aberto encontrado.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={groups}
      keyExtractor={(g) => g.id}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <View style={styles.msgRow}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.msgAvatar} />
          ) : (
            <View style={[styles.msgAvatar, styles.groupAvatar]}>
              <Ionicons name="people" size={24} color={Colors.primary} />
            </View>
          )}
          <View style={styles.msgContent}>
            <Text style={styles.msgName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.msgPreview} numberOfLines={1}>
              {item.membersCount} {item.membersCount === 1 ? 'membro' : 'membros'}
              {item.neighborhood ? ` · ${item.neighborhood}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.joinBtn}
            activeOpacity={0.85}
            disabled={joining === item.id}
            onPress={() => join(item)}
          >
            {joining === item.id ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.joinBtnText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

function MessageSearchResults({
  results,
  loading,
  nothingElse,
}: {
  results: MessageResult[];
  loading: boolean;
  nothingElse: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();

  if (loading) {
    return <ActivityIndicator color={Colors.primary} style={styles.loader} />;
  }
  if (results.length === 0) {
    // Só mostra "nada encontrado" se também não houver conversas casando pelo nome.
    return nothingElse ? (
      <View style={styles.empty}>
        <Ionicons name="search-outline" size={44} color={Colors.textTertiary} />
        <Text style={styles.emptyDesc}>Nenhuma conversa ou mensagem encontrada.</Text>
      </View>
    ) : null;
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Mensagens</Text>
      {results.map((m) => (
        <TouchableOpacity
          key={m.id}
          style={styles.msgRow}
          activeOpacity={0.85}
          onPress={() => router.push(`/messages/${m.user.id}?messageId=${m.id}` as any)}
        >
          <Image source={{ uri: m.user.avatar }} style={styles.msgAvatar} />
          <View style={styles.msgContent}>
            <View style={styles.msgHeader}>
              <Text style={styles.msgName} numberOfLines={1}>{m.user.name}</Text>
              <Text style={styles.msgTime}>{formatPostTime(m.createdAt)}</Text>
            </View>
            <Text style={styles.msgPreview} numberOfLines={1}>
              {m.fromMe ? 'Você: ' : ''}{m.content}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
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
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  newGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 36,
  },
  newGroupText: { color: '#fff', fontSize: 13, fontWeight: '700' },
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
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  tabActive: { backgroundColor: Colors.primaryLight },
  tabText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primaryDark },
  separator: { height: 1, backgroundColor: Colors.borderLight },
  loader: { marginTop: 60 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: Colors.surface,
  },
  msgAvatarWrapper: { position: 'relative' },
  msgAvatar: { width: 52, height: 52, borderRadius: 16 },
  groupAvatar: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgContent: { flex: 1, minWidth: 0 },
  msgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
    gap: 8,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 },
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
  joinBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 11,
    paddingHorizontal: 16,
    height: 36,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptyDesc: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', maxWidth: 240 },
});
