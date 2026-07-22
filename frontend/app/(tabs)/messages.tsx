import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
  Pressable,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { User } from '../../data/mock';
import { useAuth } from '../../lib/auth';
import { useRealtime } from '../../lib/realtime';
import { useRegisterScrollToTop } from '../../lib/scrollToTop';
import { useTheme, useThemedStyles } from '../../lib/theme';
import {
  api,
  Conversation,
  Group,
  GroupConversation,
  MessageResult,
} from '../../lib/api';
import { adsApi, Ad } from '../../lib/adsApi';
import { getOrCreateAdViewerId } from '../../lib/storage';
import { formatConversationTime, formatPostTime } from '../../lib/time';
import LeftSidebar from '../../components/LeftSidebar';
import MobileMenu from '../../components/MobileMenu';
import ChatView, { ChatTarget } from '../../components/ChatView';
import { CONTENT_MAX_W } from '../../components/WideLayout';

const WIDE = 900;
const LEFT_W = 220;
const MIDDLE_W = 360;
const DETAIL_W = 640;

type Selected = ChatTarget & { messageId?: string };

type ConvInboxItem =
  | { kind: 'dm'; key: string; time: string; conversation: Conversation }
  | { kind: 'group'; key: string; time: string; conversation: GroupConversation };

type InboxItem = ConvInboxItem | { kind: 'ad'; key: string; ad: Ad };

type SearchTab = 'yours' | 'discover';

export default function MessagesScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { subscribeMessages } = useRealtime();
  const { user } = useAuth();

  const [selected, setSelected] = useState<Selected | null>(null);
  const [ad, setAd] = useState<Ad | null>(null);
  const [adViewerId, setAdViewerId] = useState<string | undefined>(undefined);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [neighbors, setNeighbors] = useState<User[]>([]);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<SearchTab>('yours');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgResults, setMsgResults] = useState<MessageResult[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [discovered, setDiscovered] = useState<Group[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const listRef = useRef<FlatList<InboxItem>>(null);

  useRegisterScrollToTop('messages', () => {
    if (selected && !isWide) {
      setSelected(null);
    } else {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  });

  const load = useCallback(() => {
    // Vizinhos para o modal de "Nova conversa" (recarrega no foco: robusto ao token).
    api.getNeighbors().then(setNeighbors).catch(() => {});
    return Promise.all([
      api.getConversations().catch(() => [] as Conversation[]),
      api.getGroupConversations().catch(() => [] as GroupConversation[]),
    ])
      .then(([dms, gs]) => {
        setConversations(dms);
        setGroups(gs);
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    getOrCreateAdViewerId().then(setAdViewerId);
  }, []);

  useFocusEffect(
    useCallback(() => {
      adsApi
        .getAd('conversation', {
          neighborhood: user?.neighborhood,
          engagement: (user?.interactionsCount ?? 0) >= 5 ? 'active' : undefined,
          viewerId: adViewerId,
        })
        .then(setAd)
        .catch(() => setAd(null));
    }, [user?.neighborhood, user?.interactionsCount, adViewerId]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Atualiza a lista de conversas ao vivo quando chega mensagem nova (via websocket).
  useEffect(() => subscribeMessages(() => load()), [subscribeMessages, load]);

  const inbox = useMemo<ConvInboxItem[]>(() => {
    const items: ConvInboxItem[] = [
      ...conversations.map((c): ConvInboxItem => ({ kind: 'dm', key: `u${c.user.id}`, time: c.time, conversation: c })),
      ...groups.map((g): ConvInboxItem => ({ kind: 'group', key: `g${g.group.id}`, time: g.time, conversation: g })),
    ];
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [conversations, groups]);

  const searching = search.trim() !== '';

  const filteredInbox = useMemo(() => {
    if (!searching) return inbox;
    const q = search.toLowerCase();
    return inbox.filter((it) =>
      it.kind === 'dm'
        ? it.conversation.user.name.toLowerCase().includes(q)
        : it.conversation.group.name.toLowerCase().includes(q),
    );
  }, [inbox, searching, search]);

  // O anúncio (se houver) é fixado no topo — só fora do modo de busca, e sem
  // nenhuma linha reservada quando não existe campanha ativa para o formato.
  const displayInbox = useMemo<InboxItem[]>(() => {
    if (searching || !ad) return filteredInbox;
    return [{ kind: 'ad', key: `ad-${ad.id}`, ad }, ...filteredInbox];
  }, [filteredInbox, searching, ad]);

  const runSearch = (term: string) => {
    const id = ++seq.current;
    setMsgLoading(true);
    setDiscoverLoading(true);
    api.searchMessages(term)
      .then((r) => id === seq.current && setMsgResults(r))
      .catch(() => id === seq.current && setMsgResults([]))
      .finally(() => id === seq.current && setMsgLoading(false));
    api.discoverGroups(term)
      .then((r) => id === seq.current && setDiscovered(r))
      .catch(() => id === seq.current && setDiscovered([]))
      .finally(() => id === seq.current && setDiscoverLoading(false));
  };

  const onChangeSearch = (v: string) => {
    setSearch(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim() === '') {
      seq.current++;
      setMsgResults([]);
      setDiscovered([]);
      setMsgLoading(false);
      setDiscoverLoading(false);
      return;
    }
    timer.current = setTimeout(() => runSearch(v.trim()), 300);
  };

  // Ao abrir uma conversa, zera o selo dela na hora (a leitura de verdade é
  // feita pelo ChatView ao buscar a thread) — sem esperar o próximo refresh.
  const open = (t: Selected) => {
    setSelected(t);
    if (t.kind === 'dm') {
      setConversations((prev) =>
        prev.map((c) => (c.user.id === t.id && c.unread > 0 ? { ...c, unread: 0 } : c)),
      );
    } else {
      setGroups((prev) =>
        prev.map((g) => (g.group.id === t.id && g.unread > 0 ? { ...g, unread: 0 } : g)),
      );
    }
  };
  const isActive = (kind: 'dm' | 'group', id: string) =>
    !!selected && selected.kind === kind && selected.id === id;

  const startDm = (u: User) => {
    setNewConvOpen(false);
    open({ kind: 'dm', id: u.id });
  };

  const joinAndOpen = async (g: Group) => {
    try {
      await api.joinGroup(g.id);
      load();
      open({ kind: 'group', id: g.id });
    } catch {
      /* ignora */
    }
  };

  // ── Coluna do meio: lista de conversas ──────────────────────────────
  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.listHeaderTop}>
        <Text style={styles.listTitle}>Mensagens</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.composeBtn} activeOpacity={0.85} onPress={() => setNewConvOpen(true)}>
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.composeBtnText}>Nova</Text>
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
  );

  const listContent =
    searching && tab === 'discover' ? (
      <View style={styles.flex}>
        {listHeader}
        <DiscoverList groups={discovered} loading={discoverLoading} onEnter={joinAndOpen} />
      </View>
    ) : (
      <View style={styles.flex}>
        {listHeader}
        <FlatList
          ref={listRef}
          data={displayInbox}
          keyExtractor={(item) => item.key}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            if (item.kind === 'ad') {
              return <AdInboxRow ad={item.ad} viewerId={adViewerId} />;
            }
            const active =
              item.kind === 'dm'
                ? isActive('dm', item.conversation.user.id)
                : isActive('group', item.conversation.group.id);
            return (
              <InboxRow
                item={item}
                active={active}
                onPress={() =>
                  open(
                    item.kind === 'dm'
                      ? { kind: 'dm', id: item.conversation.user.id }
                      : { kind: 'group', id: item.conversation.group.id },
                  )
                }
              />
            );
          }}
          ListFooterComponent={
            searching ? (
              <MessageSearchResults
                results={msgResults}
                loading={msgLoading}
                nothingElse={filteredInbox.length === 0}
                onOpen={(m) => open({ kind: 'dm', id: m.user.id, messageId: m.id })}
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
                <Text style={styles.emptyDesc}>Toque em “Nova” para falar com um vizinho ou criar um grupo</Text>
              </View>
            )
          }
        />
      </View>
    );

  // ── Coluna da direita: a conversa (ou estado vazio) ─────────────────
  const detailContent = selected ? (
    <ChatView
      key={`${selected.kind}-${selected.id}`}
      target={{ kind: selected.kind, id: selected.id }}
      messageId={selected.messageId}
      onBack={isWide ? undefined : () => setSelected(null)}
      onActivity={load}
    />
  ) : (
    <View style={styles.detailEmpty}>
      <View style={styles.detailEmptyIcon}>
        <Ionicons name="chatbubbles-outline" size={40} color={Colors.primary} />
      </View>
      <Text style={styles.detailEmptyTitle}>Suas mensagens</Text>
      <Text style={styles.detailEmptyDesc}>
        Selecione uma conversa à esquerda ou comece uma nova para conversar com seus vizinhos.
      </Text>
      <TouchableOpacity style={styles.startBtn} activeOpacity={0.85} onPress={() => setNewConvOpen(true)}>
        <Ionicons name="create-outline" size={18} color="#fff" />
        <Text style={styles.startBtnText}>Começar nova conversa</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isWide ? (
        <View style={[styles.wideBody, { paddingLeft: Math.max(0, (width - CONTENT_MAX_W) / 2) }]}>
          <ScrollView style={styles.leftCol} showsVerticalScrollIndicator={false}>
            <LeftSidebar />
          </ScrollView>
          <View style={styles.middleCol}>{listContent}</View>
          <View style={styles.detailCol}>{detailContent}</View>
        </View>
      ) : selected ? (
        <View style={styles.flex}>{detailContent}</View>
      ) : (
        <View style={styles.mobileBody}>{listContent}</View>
      )}

      <NewConversationModal
        visible={newConvOpen}
        neighbors={neighbors}
        onClose={() => setNewConvOpen(false)}
        onPickNeighbor={startDm}
        onCreateGroup={() => {
          setNewConvOpen(false);
          router.push('/groups/new' as any);
        }}
      />
    </SafeAreaView>
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

function InboxRow({ item, active, onPress }: { item: ConvInboxItem; active: boolean; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const { typingDmUserIds, typingGroupUserIds } = useRealtime();
  const isGroup = item.kind === 'group';
  const name = isGroup ? item.conversation.group.name : item.conversation.user.name;
  const avatar = isGroup ? item.conversation.group.avatar : item.conversation.user.avatar;
  const isMuted = isGroup ? item.conversation.group.isMuted : item.conversation.isMuted;
  const { lastMessage, unread } = item.conversation;
  const isTyping = isGroup
    ? typingGroupUserIds(item.conversation.group.id).length > 0
    : typingDmUserIds.has(item.conversation.user.id);

  return (
    <TouchableOpacity style={[styles.msgRow, active && styles.msgRowActive]} activeOpacity={0.85} onPress={onPress}>
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
            <Text style={[styles.msgName, unread > 0 && styles.msgNameBold]} numberOfLines={1}>{name}</Text>
            {isMuted && <Ionicons name="notifications-off-outline" size={13} color={Colors.textTertiary} />}
          </View>
          <Text style={[styles.msgTime, unread > 0 && styles.msgTimeBold]}>{formatConversationTime(item.time)}</Text>
        </View>
        <View style={styles.msgFooter}>
          <Text
            style={[styles.msgPreview, unread > 0 && styles.msgPreviewBold, isTyping && styles.msgPreviewTyping]}
            numberOfLines={1}
          >
            {isTyping ? 'digitando…' : lastMessage}
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

function AdInboxRow({ ad, viewerId }: { ad: Ad; viewerId?: string }) {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();

  const open = () => {
    adsApi.trackAdClick(ad.id, { viewerId, creativeId: ad.creativeId, format: 'conversation' });
    Linking.openURL(ad.targetUrl);
  };

  return (
    <TouchableOpacity style={styles.msgRow} activeOpacity={0.85} onPress={open}>
      {ad.imageUrl ? (
        <Image source={{ uri: ad.imageUrl }} style={styles.msgAvatar} />
      ) : (
        <View style={[styles.msgAvatar, styles.groupAvatar]}>
          <Ionicons name="megaphone" size={22} color={Colors.accent} />
        </View>
      )}
      <View style={styles.msgContent}>
        <View style={styles.msgHeader}>
          <View style={styles.nameRow}>
            <Text style={styles.msgName} numberOfLines={1}>{ad.title}</Text>
          </View>
          <Text style={styles.msgTime}>Anúncio</Text>
        </View>
        <Text style={styles.msgPreview} numberOfLines={1}>{ad.content}</Text>
      </View>
    </TouchableOpacity>
  );
}

function DiscoverList({
  groups,
  loading,
  onEnter,
}: {
  groups: Group[];
  loading: boolean;
  onEnter: (g: Group) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const [joining, setJoining] = useState<string | null>(null);

  const enter = async (g: Group) => {
    setJoining(g.id);
    await onEnter(g);
    setJoining(null);
  };

  if (loading) return <ActivityIndicator color={Colors.primary} style={styles.loader} />;
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
          <TouchableOpacity style={styles.joinBtn} activeOpacity={0.85} disabled={joining === item.id} onPress={() => enter(item)}>
            {joining === item.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.joinBtnText}>Entrar</Text>}
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
  onOpen,
}: {
  results: MessageResult[];
  loading: boolean;
  nothingElse: boolean;
  onOpen: (m: MessageResult) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  if (loading) return <ActivityIndicator color={Colors.primary} style={styles.loader} />;
  if (results.length === 0) {
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
        <TouchableOpacity key={m.id} style={styles.msgRow} activeOpacity={0.85} onPress={() => onOpen(m)}>
          <Image source={{ uri: m.user.avatar }} style={styles.msgAvatar} />
          <View style={styles.msgContent}>
            <View style={styles.msgHeader}>
              <Text style={styles.msgName} numberOfLines={1}>{m.user.name}</Text>
              <Text style={styles.msgTime}>{formatPostTime(m.createdAt)}</Text>
            </View>
            <Text style={styles.msgPreview} numberOfLines={1}>{m.fromMe ? 'Você: ' : ''}{m.content}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function NewConversationModal({
  visible,
  neighbors,
  onClose,
  onPickNeighbor,
  onCreateGroup,
}: {
  visible: boolean;
  neighbors: User[];
  onClose: () => void;
  onPickNeighbor: (u: User) => void;
  onCreateGroup: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose} tabIndex={-1}>
        <Pressable style={styles.modalCard} onPress={() => {}} tabIndex={-1}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nova conversa</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.newGroupRow} activeOpacity={0.85} onPress={onCreateGroup}>
            <View style={styles.newGroupIcon}>
              <Ionicons name="people" size={20} color="#fff" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.newGroupTitle}>Criar novo grupo</Text>
              <Text style={styles.newGroupDesc}>Converse com vários vizinhos ao mesmo tempo</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>

          <Text style={styles.modalSection}>Vizinhos</Text>
          <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
            {neighbors.length === 0 ? (
              <Text style={styles.modalEmpty}>Nenhum vizinho para conversar por enquanto.</Text>
            ) : (
              neighbors.map((u) => (
                <TouchableOpacity key={u.id} style={styles.neighborRow} activeOpacity={0.8} onPress={() => onPickNeighbor(u)}>
                  <Image source={{ uri: u.avatar }} style={styles.neighborAvatar} />
                  <View style={styles.flex}>
                    <Text style={styles.neighborName} numberOfLines={1}>{u.name}</Text>
                    <Text style={styles.neighborSub} numberOfLines={1}>@{u.username}</Text>
                  </View>
                  <Ionicons name="chatbubble-outline" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  container: { flex: 1, backgroundColor: Colors.background },
  wideBody: { flex: 1, flexDirection: 'row', backgroundColor: Colors.background },
  leftCol: {
    width: LEFT_W,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: Colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  middleCol: {
    width: MIDDLE_W,
    flexShrink: 0,
    backgroundColor: Colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  detailCol: { width: DETAIL_W, flexShrink: 1, minWidth: 0, backgroundColor: Colors.background },
  mobileBody: { flex: 1, backgroundColor: Colors.surface },

  // Cabeçalho da lista
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  listHeaderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  composeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 36,
  },
  composeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
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
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.background },
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

  // Linha de conversa
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: Colors.surface },
  msgRowActive: { backgroundColor: Colors.primaryFaint },
  msgAvatarWrapper: { position: 'relative' },
  msgAvatar: { width: 52, height: 52, borderRadius: 16 },
  groupAvatar: { backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  msgContent: { flex: 1, minWidth: 0 },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 },
  msgName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  msgNameBold: { fontWeight: '800' },
  msgTime: { fontSize: 12, color: Colors.textTertiary },
  msgTimeBold: { color: Colors.primary, fontWeight: '700' },
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  msgPreview: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  msgPreviewBold: { color: Colors.text, fontWeight: '600' },
  msgPreviewTyping: { color: Colors.primary, fontWeight: '700' },
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptyDesc: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', maxWidth: 260 },

  // Estado vazio da coluna de detalhe
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  detailEmptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailEmptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  detailEmptyDesc: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', maxWidth: 340, lineHeight: 20 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 22,
    height: 48,
    marginTop: 6,
  },
  startBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Modal "Nova conversa"
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    ...Colors.shadow.lg,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  newGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.primaryFaint,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  newGroupIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newGroupTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  newGroupDesc: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  modalSection: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 4,
  },
  modalList: { maxHeight: 320 },
  modalEmpty: { fontSize: 13, color: Colors.textTertiary, paddingVertical: 14, textAlign: 'center' },
  neighborRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  neighborAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.border },
  neighborName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  neighborSub: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
});
