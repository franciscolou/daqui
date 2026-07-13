import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withDelay, withRepeat, withSequence, Easing,
} from 'react-native-reanimated';
import { Palette } from '../constants/Colors';
import { User } from '../data/mock';
import { api, ChatMessage, GroupDetail } from '../lib/api';
import { formatDayDivider, formatMessageTime } from '../lib/time';
import { useAuth } from '../lib/auth';
import { useRealtime } from '../lib/realtime';
import { useTheme, useThemedStyles } from '../lib/theme';
import { submitOnEnter } from '../lib/keyboard';
import SharedPostPreview from './SharedPostPreview';
import SharedCommentPreview from './SharedCommentPreview';

export type ChatTarget = { kind: 'dm' | 'group'; id: string };

const INPUT_MIN_HEIGHT = 40;
const INPUT_LINE_HEIGHT = 18;
// 10 linhas de texto + padding vertical do input (10 em cima, 10 embaixo)
const INPUT_MAX_HEIGHT = INPUT_LINE_HEIGHT * 10 + 20;

type ChatItem =
  | { type: 'msg'; msg: ChatMessage }
  | { type: 'divider'; id: string; label: string }
  | { type: 'typing' };

// Balão de mensagem. Definido no módulo (não dentro de ChatView) para não remontar
// a cada render — assim a animação de entrada roda só uma vez, na mensagem recém-enviada.
const DOUBLE_TAP_MS = 400;

function MessageBubble({
  msg,
  mine,
  showSender,
  highlighted,
  animateIn,
  styles,
  onReply,
  onJumpTo,
}: {
  msg: ChatMessage;
  mine: boolean;
  showSender: boolean;
  highlighted: boolean;
  animateIn: boolean;
  styles: ReturnType<typeof makeStyles>;
  onReply: (msg: ChatMessage) => void;
  onJumpTo: (id: string) => void;
}) {
  const Colors = useTheme();
  const ty = useSharedValue(animateIn ? 16 : 0);
  const op = useSharedValue(animateIn ? 0 : 1);
  const lastTapRef = useRef(0);
  // No web, o ícone de responder só aparece com o mouse em cima da mensagem
  // (como o duplo clique não é óbvio); no nativo não existe "hover", então
  // fica sempre visível — senão a ação ficaria sem nenhuma forma descoberta.
  const [hovered, setHovered] = useState(false);
  const showReplyIcon = Platform.OS !== 'web' || hovered;
  // Post ou comentário encaminhado: recebem o mesmo tratamento de balão "shared".
  const hasShared = !!msg.sharedPost || !!msg.sharedComment;

  // Duplo toque na mensagem (ou na altura dela, na área ao redor do balão)
  // marca ela como a que está sendo respondida.
  const handlePress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      onReply(msg);
    } else {
      lastTapRef.current = now;
    }
  };

  useEffect(() => {
    if (!animateIn) return;
    // sobe rápido e "assenta" com um leve spring; opacidade acompanha
    ty.value = withSpring(0, { damping: 15, stiffness: 200, mass: 0.6 });
    op.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity: op.value,
  }));

  return (
    <Animated.View style={animStyle}>
      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
        {showSender && (
          <TouchableOpacity onPress={() => router.push(`/user/${msg.sender.id}` as any)}>
            <Image source={{ uri: msg.sender.avatar }} style={styles.senderAvatar} />
          </TouchableOpacity>
        )}
        <Pressable
          style={[styles.bubbleTapArea, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
          onPress={handlePress}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
        >
        {mine && (
          <TouchableOpacity
            style={[styles.replyIconBtn, !showReplyIcon && styles.replyIconBtnHidden]}
            onPress={() => onReply(msg)}
            disabled={!showReplyIcon}
            hitSlop={8}
          >
            <Ionicons name="arrow-undo-outline" size={14} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
        <View
          style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            hasShared && styles.bubbleShared,
            highlighted && styles.bubbleHighlight,
          ]}
        >
          {showSender && (
            <Text style={styles.senderName} numberOfLines={1}>{msg.sender.name}</Text>
          )}
          {!!msg.replyTo && (
            <TouchableOpacity
              style={[styles.replyQuote, mine && !hasShared && styles.replyQuoteMine]}
              onPress={() => onJumpTo(msg.replyTo!.id)}
            >
              <Text
                style={[styles.replyQuoteSender, mine && !hasShared && styles.replyQuoteTextMine]}
                numberOfLines={1}
              >
                {msg.replyTo.sender.name}
              </Text>
              <Text
                style={[styles.replyQuoteText, mine && !hasShared && styles.replyQuoteTextMine]}
                numberOfLines={1}
              >
                {msg.replyTo.content || 'Post compartilhado'}
              </Text>
            </TouchableOpacity>
          )}
          {!!msg.sharedPost && (
            <View style={styles.sharedWrap}>
              <SharedPostPreview post={msg.sharedPost} />
            </View>
          )}
          {!!msg.sharedComment && (
            <View style={styles.sharedWrap}>
              <SharedCommentPreview comment={msg.sharedComment} />
            </View>
          )}
          {!!msg.content && (
            <Text style={[styles.bubbleText, mine && !hasShared && styles.bubbleTextMine]}>
              {msg.content}
            </Text>
          )}
          <Text
            style={[
              styles.bubbleTime,
              mine && !hasShared && styles.bubbleTimeMine,
              hasShared && styles.bubbleTimeShared,
            ]}
          >
            {formatMessageTime(msg.createdAt)}
          </Text>
        </View>
        {!mine && (
          <TouchableOpacity
            style={[styles.replyIconBtn, !showReplyIcon && styles.replyIconBtnHidden]}
            onPress={() => onReply(msg)}
            disabled={!showReplyIcon}
            hitSlop={8}
          >
            <Ionicons name="arrow-undo-outline" size={14} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

// Balão de "digitando…": entra como se fosse uma mensagem nova (mesma
// animação de subida do MessageBubble), com as três bolinhas balançando em
// looping e defasadas entre si.
function TypingBubble({
  avatar,
  showAvatar,
  styles,
}: {
  avatar: string | null;
  showAvatar: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  const ty = useSharedValue(16);
  const op = useSharedValue(0);
  const b1 = useSharedValue(0);
  const b2 = useSharedValue(0);
  const b3 = useSharedValue(0);

  useEffect(() => {
    ty.value = withSpring(0, { damping: 15, stiffness: 200, mass: 0.6 });
    op.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
    const bounce = (v: typeof b1, delay: number) => {
      v.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-5, { duration: 260, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }),
          ),
          -1,
        ),
      );
    };
    bounce(b1, 0);
    bounce(b2, 140);
    bounce(b3, 280);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity: op.value,
  }));
  const dot1Style = useAnimatedStyle(() => ({ transform: [{ translateY: b1.value }] }));
  const dot2Style = useAnimatedStyle(() => ({ transform: [{ translateY: b2.value }] }));
  const dot3Style = useAnimatedStyle(() => ({ transform: [{ translateY: b3.value }] }));

  return (
    <Animated.View style={wrapStyle}>
      <View style={[styles.bubbleRow, styles.bubbleRowTheirs]}>
        {showAvatar &&
          (avatar ? (
            <Image source={{ uri: avatar }} style={styles.senderAvatar} />
          ) : (
            <View style={styles.senderAvatar} />
          ))}
        <View style={[styles.bubble, styles.bubbleTheirs, styles.typingBubble]}>
          <Animated.View style={[styles.typingDot, dot1Style]} />
          <Animated.View style={[styles.typingDot, dot2Style]} />
          <Animated.View style={[styles.typingDot, dot3Style]} />
        </View>
      </View>
    </Animated.View>
  );
}

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
  const { subscribeMessages, refreshUnreadCounts, typingDmUserIds, typingGroupUserIds, pingTyping } =
    useRealtime();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [other, setOther] = useState<User | null>(null);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);
  const inputRef = useRef<TextInput>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(messageId ?? null);
  // ids que devem animar a entrada (mensagem que eu acabei de enviar, ou que
  // chegou agora por tempo real) — mesmo efeito nos dois casos
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());
  // mensagem marcada (duplo clique) para responder — some ao enviar ou cancelar
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  const listRef = useRef<FlatList<ChatItem>>(null);
  const didScrollRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const animateEntrance = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setEnteringIds((prev) => new Set([...prev, ...ids]));
    setTimeout(() => {
      setEnteringIds((prev) => {
        const next = new Set(prev);
        ids.forEach((msgId) => next.delete(msgId));
        return next;
      });
    }, 600);
  }, []);

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
      // Buscar a thread já marca como lida no servidor — sincroniza o selo
      // global (sidebar/tab bar) agora, sem esperar o próximo tick do websocket.
      refreshUnreadCounts();
    } catch {
      setOther(null);
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [id, kind, refreshUnreadCounts]);

  useEffect(() => {
    load();
  }, [load]);

  // Atualização silenciosa: busca a thread de novo (o que também marca como
  // lida no servidor) mas só funde as mensagens novas na lista existente, sem
  // trocar pra tela de loading nem re-renderizar as mensagens já exibidas.
  const refreshQuiet = useCallback(async () => {
    if (!id) return;
    try {
      const thread =
        kind === 'dm' ? await api.getThread(id) : await api.getGroupThread(id);
      const existingIds = new Set(messagesRef.current.map((m) => m.id));
      const freshIds = thread.filter((m) => !existingIds.has(m.id)).map((m) => m.id);
      setMessages(thread);
      animateEntrance(freshIds);
      // idem: essa mensagem nova já foi marcada como lida no servidor (a
      // thread está aberta), então o selo global pode ser atualizado agora.
      if (freshIds.length) refreshUnreadCounts();
    } catch {
      /* falha pontual: mantém o que já está na tela */
    }
  }, [id, kind, animateEntrance, refreshUnreadCounts]);

  // Dispara a atualização silenciosa quando chega mensagem nova nesta
  // conversa (via websocket), sem precisar dar refresh na página.
  useEffect(
    () =>
      subscribeMessages((senderIds, groupIds) => {
        const isForThisThread = kind === 'dm' ? senderIds.includes(id) : groupIds.includes(id);
        if (isForThisThread) refreshQuiet();
      }),
    [subscribeMessages, kind, id, refreshQuiet],
  );

  const send = useCallback(async () => {
    const content = input.trim();
    if (!content || !id || sending) return;
    const replyToId = replyingTo?.id;
    setSending(true);
    setInput('');
    setInputHeight(INPUT_MIN_HEIGHT);
    setReplyingTo(null);
    try {
      const msg =
        kind === 'dm'
          ? await api.sendMessage(id, content, undefined, replyToId)
          : await api.sendGroupMessage(id, content, replyToId);
      setMessages((prev) => [...prev, msg]);
      animateEntrance([msg.id]);
      onActivity?.();
    } catch {
      setInput(content);
      setReplyingTo(replyingTo ?? null);
    } finally {
      setSending(false);
    }
  }, [input, id, kind, sending, onActivity, animateEntrance, replyingTo]);

  // Na web, o scrollHeight de um textarea nunca fica menor que a altura já
  // aplicada via CSS — por isso, para encolher ao apagar texto, é preciso
  // zerar a altura antes de medir de novo. Nativo já encolhe sozinho via
  // onContentSizeChange (mede o texto, não a caixa), então isso é só pra web.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!node?.style) return;
    // sem isso, o <textarea> assume o default de 2 rows quando a altura é
    // 'auto', e o scrollHeight nunca reflete o conteúdo de fato
    node.rows = 1;
    node.style.height = 'auto';
    const next = Math.min(Math.max(node.scrollHeight, INPUT_MIN_HEIGHT), INPUT_MAX_HEIGHT);
    node.style.height = `${next}px`;
    setInputHeight(next);
  }, [input]);

  // "Digitando": no DM, é só o outro participante; no grupo, cruza os ids de
  // quem está digitando com os membros pra achar os usuários.
  const typingUsers = useMemo(() => {
    if (kind === 'dm') {
      return other && typingDmUserIds.has(other.id) ? [other] : [];
    }
    const ids = typingGroupUserIds(id);
    if (!ids.length || !group) return [];
    return ids
      .map((uid) => group.members.find((m) => m.user.id === uid)?.user)
      .filter((u): u is User => !!u);
  }, [kind, other, typingDmUserIds, typingGroupUserIds, id, group]);

  // FlatList invertida: itens com divisores de dia, mais recente primeiro —
  // o balão de "digitando" (quando presente) fica na ponta, como se fosse a
  // próxima mensagem chegando.
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
    const reversed = items.reverse();
    return typingUsers.length ? [{ type: 'typing' }, ...reversed] : reversed;
  }, [messages, typingUsers]);

  const targetIndex = useMemo(
    () => (messageId ? data.findIndex((it) => it.type === 'msg' && it.msg.id === messageId) : -1),
    [data, messageId],
  );

  // Pula (com scroll e realce) para uma mensagem já carregada na conversa —
  // usado ao tocar na prévia de "respondendo a" dentro de um balão.
  const jumpToMessage = useCallback(
    (targetId: string) => {
      const index = data.findIndex((it) => it.type === 'msg' && it.msg.id === targetId);
      if (index < 0) return;
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
      setHighlightId(targetId);
    },
    [data],
  );

  useEffect(() => {
    setHighlightId(messageId ?? null);
    setReplyingTo(null);
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
            keyExtractor={(item) =>
              item.type === 'divider' ? item.id : item.type === 'typing' ? 'typing-indicator' : item.msg.id
            }
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
              if (item.type === 'typing') {
                return (
                  <TypingBubble
                    avatar={typingUsers[0]?.avatar ?? null}
                    showAvatar={kind === 'group'}
                    styles={styles}
                  />
                );
              }
              return (
                <MessageBubble
                  msg={item.msg}
                  mine={!!me && item.msg.sender.id === me.id}
                  showSender={kind === 'group' && !(!!me && item.msg.sender.id === me.id)}
                  highlighted={item.msg.id === highlightId}
                  animateIn={enteringIds.has(item.msg.id)}
                  onReply={setReplyingTo}
                  onJumpTo={jumpToMessage}
                  styles={styles}
                />
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

          {/* Prévia de "respondendo a" — some ao enviar ou cancelar */}
          {!!replyingTo && (
            <View style={styles.replyBar}>
              <View style={styles.replyBarAccent} />
              <View style={styles.flex}>
                <Text style={styles.replyBarSender} numberOfLines={1}>
                  Respondendo a {replyingTo.sender.name}
                </Text>
                <Text style={styles.replyBarText} numberOfLines={1}>
                  {replyingTo.content || 'Post compartilhado'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={8}>
                <Ionicons name="close" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Composer */}
          <View style={styles.composer}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { height: inputHeight }]}
              placeholder="Escreva uma mensagem..."
              placeholderTextColor={Colors.textTertiary}
              value={input}
              onChangeText={(v) => {
                setInput(v);
                if (v.trim() && id) pingTyping({ kind, id });
              }}
              multiline
              onContentSizeChange={(e) => {
                // Na web quem manda é o useLayoutEffect acima (precisa zerar a
                // altura antes de medir pra conseguir encolher); aqui só nativo.
                if (Platform.OS === 'web') return;
                setInputHeight(
                  Math.min(
                    Math.max(e.nativeEvent.contentSize.height, INPUT_MIN_HEIGHT),
                    INPUT_MAX_HEIGHT,
                  ),
                );
              }}
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
  bubbleTapArea: { flex: 1, flexDirection: 'row' },
  // Botão de responder: aparece ao lado de qualquer balão (inclusive os
  // próprios) — alternativa visível ao duplo toque, que sozinho não é óbvio.
  replyIconBtn: { alignSelf: 'center', padding: 6, borderRadius: 12, marginHorizontal: 2 },
  // Mantém o espaço reservado (evita o balão "pulando" ao mostrar/esconder) —
  // só fica transparente e sem interação fora do hover (ou fora do web).
  replyIconBtnHidden: { opacity: 0 },
  senderAvatar: { width: 28, height: 28, borderRadius: 9, backgroundColor: Colors.border },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  replyQuote: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  replyQuoteMine: { backgroundColor: 'rgba(255,255,255,0.14)', borderLeftColor: '#fff' },
  replyQuoteSender: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  replyQuoteText: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  replyQuoteTextMine: { color: 'rgba(255,255,255,0.85)' },
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
  bubbleMine: { backgroundColor: Colors.primaryDeep, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  bubbleHighlight: { borderWidth: 2, borderColor: Colors.primary, ...Colors.shadow.md },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 14 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.textTertiary },
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
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  replyBarAccent: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: Colors.primary },
  replyBarSender: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  replyBarText: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
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
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    lineHeight: INPUT_LINE_HEIGHT,
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
