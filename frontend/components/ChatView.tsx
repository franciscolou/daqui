import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Palette } from '../constants/Colors';
import { User } from '../data/mock';
import { api, ChatMessage, GroupDetail } from '../lib/api';
import { formatDayDivider, formatMessageTime } from '../lib/time';
import { useAuth } from '../lib/auth';
import { useTheme, useThemedStyles } from '../lib/theme';
import { submitOnEnter } from '../lib/keyboard';
import SharedPostPreview from './SharedPostPreview';

export type ChatTarget = { kind: 'dm' | 'group'; id: string };

type ChatItem = { type: 'msg'; msg: ChatMessage } | { type: 'divider'; id: string; label: string };

export default function ChatView({
  target,
  messageId,
  onBack,
  onActivity,
}: {
  target: ChatTarget;
  messageId?: string;
  onBack?: () => void; // mostra o botão de voltar quando definido
  onActivity?: () => void; // avisa o pai para recarregar a lista de conversas
}) {
  const { kind, id } = target;
  const { user: me } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [other, setOther] = useState<User | null>(null);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(messageId ?? null);

  const listRef = useRef<FlatList<ChatItem>>(null);
  const didScrollRef = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      if (kind === 'dm') {
        const [u, thread] = await Promise.all([
          api.getUser(id),
          api.getThread(id).catch(() => [] as ChatMessage[]),
        ]);
        setOther(u);
        setMessages(thread);
      } else {
        const [g, thread] = await Promise.all([
          api.getGroup(id),
          api.getGroupThread(id).catch(() => [] as ChatMessage[]),
        ]);
        setGroup(g);
        setMessages(thread);
      }
    } catch {
      setOther(null);
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [id, kind]);

  useEffect(() => {
    load();
  }, [load]);

  const send = useCallback(async () => {
    const content = input.trim();
    if (!content || !id || sending) return;
    setSending(true);
    setInput('');
    try {
      const msg =
        kind === 'dm'
          ? await api.sendMessage(id, content)
          : await api.sendGroupMessage(id, content);
      setMessages((prev) => [...prev, msg]);
      onActivity?.();
    } catch {
      setInput(content);
    } finally {
      setSending(false);
    }
  }, [input, id, kind, sending, onActivity]);

  // FlatList invertida: itens com divisores de dia, mais recente primeiro.
  const data = useMemo<ChatItem[]>(() => {
    const items: ChatItem[] = [];
    let lastDay = '';
    for (const m of messages) {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) {
        items.push({ type: 'divider', id: `d-${day}`, label: formatDayDivider(m.createdAt) });
        lastDay = day;
      }
      items.push({ type: 'msg', msg: m });
    }
    return items.reverse();
  }, [messages]);

  const targetIndex = useMemo(
    () => (messageId ? data.findIndex((it) => it.type === 'msg' && it.msg.id === messageId) : -1),
    [data, messageId],
  );

  useEffect(() => {
    setHighlightId(messageId ?? null);
    didScrollRef.current = false;
  }, [messageId, id]);

  useEffect(() => {
    if (loading || didScrollRef.current || targetIndex < 0) return;
    didScrollRef.current = true;
    const t = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: targetIndex, viewPosition: 0.5, animated: true });
    }, 250);
    return () => clearTimeout(t);
  }, [loading, targetIndex]);

  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 2800);
    return () => clearTimeout(t);
  }, [highlightId]);

  const openInfo = () => {
    if (kind === 'dm' && other) router.push(`/user/${other.id}` as any);
    else if (kind === 'group' && group) router.push(`/groups/${group.id}/info` as any);
  };

  const headerName = kind === 'dm' ? other?.name : group?.name;
  const headerAvatar = kind === 'dm' ? other?.avatar : group?.avatar;
  const headerSub =
    kind === 'dm'
      ? other?.neighborhood
      : group
      ? `${group.membersCount} ${group.membersCount === 1 ? 'membro' : 'membros'}${group.isOpen ? ' · Aberto' : ' · Fechado'}`
      : '';

  return (
    <View style={styles.flex}>
      {/* Cabeçalho da conversa */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.headerUser} activeOpacity={0.7} onPress={openInfo}>
          {headerAvatar ? (
            <Image source={{ uri: headerAvatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarGroup]}>
              <Ionicons name="people" size={20} color={Colors.primary} />
            </View>
          )}
          <View style={styles.flex}>
            <Text style={styles.headerName} numberOfLines={1}>
              {headerName ?? (kind === 'group' ? 'Grupo' : 'Conversa')}
            </Text>
            {!!headerSub && (
              <Text style={styles.headerSub} numberOfLines={1}>{headerSub}</Text>
            )}
          </View>
        </TouchableOpacity>
        {kind === 'group' && (
          <TouchableOpacity style={styles.backBtn} onPress={openInfo}>
            <Ionicons name="information-circle-outline" size={24} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <FlatList
            ref={listRef}
            data={data}
            inverted
            keyExtractor={(item) => (item.type === 'divider' ? item.id : item.msg.id)}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true });
              }, 300);
            }}
            renderItem={({ item }) => {
              if (item.type === 'divider') {
                return (
                  <View style={styles.dayDivider}>
                    <Text style={styles.dayDividerText}>{item.label}</Text>
                  </View>
                );
              }
              const msg = item.msg;
              const mine = !!me && msg.sender.id === me.id;
              const highlighted = msg.id === highlightId;
              const showSender = kind === 'group' && !mine;
              return (
                <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                  {showSender && (
                    <TouchableOpacity onPress={() => router.push(`/user/${msg.sender.id}` as any)}>
                      <Image source={{ uri: msg.sender.avatar }} style={styles.senderAvatar} />
                    </TouchableOpacity>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.bubbleMine : styles.bubbleTheirs,
                      !!msg.sharedPost && styles.bubbleShared,
                      highlighted && styles.bubbleHighlight,
                    ]}
                  >
                    {showSender && (
                      <Text style={styles.senderName} numberOfLines={1}>{msg.sender.name}</Text>
                    )}
                    {!!msg.sharedPost && (
                      <View style={styles.sharedWrap}>
                        <SharedPostPreview post={msg.sharedPost} />
                      </View>
                    )}
                    {!!msg.content && (
                      <Text style={[styles.bubbleText, mine && !msg.sharedPost && styles.bubbleTextMine]}>
                        {msg.content}
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.bubbleTime,
                        mine && !msg.sharedPost && styles.bubbleTimeMine,
                        !!msg.sharedPost && styles.bubbleTimeShared,
                      ]}
                    >
                      {formatMessageTime(msg.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={44} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>
                  {kind === 'group'
                    ? 'Nenhuma mensagem ainda. Diga oi para o grupo!'
                    : `Comece a conversa com ${other?.name?.split(' ')[0] ?? 'seu vizinho'}`}
                </Text>
              </View>
            }
          />

          {/* Composer */}
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Escreva uma mensagem..."
              placeholderTextColor={Colors.textTertiary}
              value={input}
              onChangeText={setInput}
              multiline
              onKeyPress={submitOnEnter(send)}
              onSubmitEditing={send}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
              onPress={send}
              disabled={!input.trim() || sending}
              activeOpacity={0.85}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: Colors.border },
  headerAvatarGroup: { backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  headerSub: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 1 },
  list: { padding: 14, gap: 8, flexGrow: 1 },
  dayDivider: { alignItems: 'center', paddingVertical: 6 },
  dayDividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    backgroundColor: Colors.background,
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  senderAvatar: { width: 28, height: 28, borderRadius: 9, backgroundColor: Colors.border },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleShared: {
    maxWidth: '86%',
    minWidth: 240,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
  },
  sharedWrap: { marginBottom: 2 },
  bubbleTimeShared: { color: Colors.textTertiary, marginRight: 2 },
  senderName: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  bubbleHighlight: { borderWidth: 2, borderColor: Colors.primary, ...Colors.shadow.md },
  bubbleText: { fontSize: 14, color: Colors.text, lineHeight: 19 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: Colors.textTertiary, marginTop: 3, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 100,
    transform: [{ scaleY: -1 }],
  },
  emptyText: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', maxWidth: 240 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: Colors.text,
    outlineStyle: 'none',
  } as any,
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.textTertiary, opacity: 0.5 },
});
