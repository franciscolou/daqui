import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withDelay, withRepeat, withSequence, Easing,
} from 'react-native-reanimated';
import { Palette } from '../constants/Colors';
import {
  CHAT_DOUBLE_TAP_MS,
  CHAT_INPUT_LINE_HEIGHT,
  CHAT_INPUT_MAX_HEIGHT,
  CHAT_INPUT_MIN_HEIGHT,
} from '../constants/config';
import { User } from '../data/mock';
import { trackClick } from '../lib/analytics';
import { api, ChatMessage, GroupDetail } from '../lib/api';
import { formatDayDivider, formatMessageTime } from '../lib/time';
import { useAuth } from '../lib/auth';
import { useRealtime } from '../lib/realtime';
import { useTheme, useThemedStyles } from '../lib/theme';
import { submitOnEnter } from '../lib/keyboard';
import SharedPostPreview from './SharedPostPreview';
import SharedCommentPreview from './SharedCommentPreview';
import SharedAdPreview from './SharedAdPreview';
import MentionInput from './MentionInput';
import MentionText from './MentionText';
import ActionMenu from './ActionMenu';
import ImageViewerModal, { MediaItem } from './ImageViewerModal';
import VideoPlayer from './VideoPlayer';
import { useT } from '../lib/i18n';
import { Ad, adsApi } from '../lib/adsApi';
import { isDesktopBrowser } from '../lib/platform';

const MAX_MESSAGE_MEDIA = 10;

type MediaDraft = {
  id: string;
  localUri: string;
  type: 'image' | 'video';
  url?: string;
  uploading: boolean;
};

export type ChatTarget = { kind: 'dm' | 'group'; id: string };

type ChatItem =
  | { type: 'msg'; msg: ChatMessage }
  | { type: 'divider'; id: string; label: string }
  | { type: 'typing' };

// Balão de mensagem. Definido no módulo (não dentro de ChatView) para não remontar
// a cada render — assim a animação de entrada roda só uma vez, na mensagem recém-enviada.

function MessageBubble({
  msg,
  mine,
  showSender,
  highlighted,
  animateIn,
  linkMentions,
  styles,
  onReply,
  onJumpTo,
  onViewMedia,
}: {
  msg: ChatMessage;
  mine: boolean;
  showSender: boolean;
  highlighted: boolean;
  animateIn: boolean;
  // Menções só existem em grupos (ver checkout com o usuário — DMs não têm
  // sugeridor de @menção, então o texto "@algo" digitado numa DM é só texto).
  linkMentions: boolean;
  styles: ReturnType<typeof makeStyles>;
  onReply: (msg: ChatMessage) => void;
  onJumpTo: (id: string) => void;
  onViewMedia: (msg: ChatMessage) => void;
}) {
  const Colors = useTheme();
  const { t } = useT();
  const ty = useSharedValue(animateIn ? 16 : 0);
  const op = useSharedValue(animateIn ? 0 : 1);
  const lastTapRef = useRef(0);
  // No web, o ícone de responder só aparece com o mouse em cima da mensagem
  // (como o duplo clique não é óbvio); no nativo não existe "hover", então
  // fica sempre visível — senão a ação ficaria sem nenhuma forma descoberta.
  const [hovered, setHovered] = useState(false);
  const showReplyIcon = Platform.OS !== 'web' || hovered;
  // Post, comentário ou anúncio encaminhado: recebem o mesmo tratamento de balão "shared".
  const hasShared = !!msg.sharedPost || !!msg.sharedComment || !!msg.sharedAdId;
  // Foto/vídeo anexado tem o mesmo tratamento visual: sem fundo/padding do
  // balão (a própria mídia preenche o espaço).
  const hasMedia = msg.media.length > 0;
  const hasRich = hasShared || hasMedia;
  // Anúncio encaminhado só traz o id (ver lib/api.ts::ChatMessage.sharedAdId)
  // — o próprio ads-backend é quem tem os dados, então resolve no client.
  const [sharedAd, setSharedAd] = useState<Ad | null>(null);
  useEffect(() => {
    if (msg.sharedAdId == null) {
      setSharedAd(null);
      return;
    }
    adsApi.getAdById(msg.sharedAdId).then(setSharedAd).catch(() => setSharedAd(null));
  }, [msg.sharedAdId]);

  // Duplo toque na mensagem (ou na altura dela, na área ao redor do balão)
  // marca ela como a que está sendo respondida.
  const handlePress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < CHAT_DOUBLE_TAP_MS) {
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
          <TouchableOpacity
            style={styles.senderAvatarBtn}
            onPress={() => router.push(`/user/${msg.sender.username}` as any)}
          >
            <Image source={{ uri: msg.sender.avatar }} style={styles.senderAvatar} />
          </TouchableOpacity>
        )}
        <Pressable
          style={[styles.bubbleTapArea, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
          onPress={handlePress}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          {...({ tabIndex: -1 } as any)}
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
            hasRich && styles.bubbleShared,
            highlighted && styles.bubbleHighlight,
          ]}
        >
          {showSender && (
            <Text style={styles.senderName} numberOfLines={1}>{msg.sender.name}</Text>
          )}
          {!!msg.replyTo && (
            <TouchableOpacity
              style={[styles.replyQuote, mine && !hasRich && styles.replyQuoteMine]}
              onPress={() => onJumpTo(msg.replyTo!.id)}
            >
              <Text
                style={[styles.replyQuoteSender, mine && !hasRich && styles.replyQuoteTextMine]}
                numberOfLines={1}
              >
                {msg.replyTo.sender.name}
              </Text>
              <Text
                style={[styles.replyQuoteText, mine && !hasRich && styles.replyQuoteTextMine]}
                numberOfLines={1}
              >
                {msg.replyTo.content || t('messages.chat.sharedPost')}
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
          {!!sharedAd && (
            <View style={styles.sharedWrap}>
              <SharedAdPreview ad={sharedAd} />
            </View>
          )}
          {msg.media.length > 0 && (
            <View style={[styles.mediaWrap, msg.media.length > 1 && styles.messageMediaGrid]}>
              {msg.media.map((item, index) => (
                <Pressable
                  key={`${item.url}-${index}`}
                  nativeID={`chat-media-no-hover-${msg.id}-${index}`}
                  onPress={() => onViewMedia({ ...msg, media: msg.media.slice(index).concat(msg.media.slice(0, index)) })}
                  style={msg.media.length > 1 ? styles.messageMediaCell : undefined}
                >
                  {item.type === 'video' ? (
                    <VideoPlayer uri={item.url} style={[styles.messageMedia, msg.media.length > 1 && styles.messageMediaGridItem]} contentFit="cover" />
                  ) : (
                    <Image source={{ uri: item.url }} style={[styles.messageMedia, msg.media.length > 1 && styles.messageMediaGridItem]} resizeMode="cover" />
                  )}
                </Pressable>
              ))}
            </View>
          )}
          {!!msg.content && (
            <MentionText
              style={[styles.bubbleText, mine && !hasRich && styles.bubbleTextMine]}
              linkStyle={mine && !hasRich ? styles.bubbleMention : undefined}
              mentionsEnabled={linkMentions}
            >
              {msg.content}
            </MentionText>
          )}
          <Text
            style={[
              styles.bubbleTime,
              mine && !hasRich && styles.bubbleTimeMine,
              hasRich && styles.bubbleTimeShared,
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
  const { t } = useT();
  const isDesktopWeb = isDesktopBrowser();
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
  const [inputHeight, setInputHeight] = useState(CHAT_INPUT_MIN_HEIGHT);
  const inputRef = useRef<TextInput>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(messageId ?? null);
  // ids que devem animar a entrada (mensagem que eu acabei de enviar, ou que
  // chegou agora por tempo real) — mesmo efeito nos dois casos
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());
  // mensagem marcada (duplo clique) para responder — some ao enviar ou cancelar
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  // Fotos/vídeos preparados antes do envio, compartilhados por DM ou grupo.
  const [mediaDrafts, setMediaDrafts] = useState<MediaDraft[]>([]);
  const [hoveredDraftId, setHoveredDraftId] = useState<string | null>(null);
  const composerFocusedRef = useRef(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
  const [viewerMedia, setViewerMedia] = useState<{ media: MediaItem[]; index: number } | null>(null);

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

  const addMediaAssets = useCallback(async (assets: {
    uri: string;
    type?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
  }[]) => {
    const available = Math.max(0, MAX_MESSAGE_MEDIA - mediaDrafts.length);
    const selected = assets.slice(0, available);
    if (!selected.length) return;

    const drafts = selected.map((asset, index): MediaDraft => ({
      id: `${Date.now()}-${index}-${Math.random()}`,
      localUri: asset.uri,
      type: asset.type === 'video' ? 'video' : 'image',
      uploading: true,
    }));
    setMediaDrafts((current) => [...current, ...drafts]);

    await Promise.all(selected.map(async (asset, index) => {
      const draft = drafts[index];
      try {
        const uploaded = kind === 'dm'
          ? await api.uploadMessageAttachment({
              uri: asset.uri,
              mimeType: asset.mimeType ?? undefined,
              fileName: asset.fileName ?? undefined,
            })
          : await api.uploadGroupMessageAttachment(id, {
              uri: asset.uri,
              mimeType: asset.mimeType ?? undefined,
              fileName: asset.fileName ?? undefined,
            });
        setMediaDrafts((current) => current.map((item) =>
          item.id === draft.id
            ? { ...item, type: uploaded.type, url: uploaded.url, uploading: false }
            : item,
        ));
      } catch {
        setMediaDrafts((current) => current.filter((item) => item.id !== draft.id));
        setMediaError(t('messages.chat.mediaUploadError'));
      }
    }));
  }, [id, kind, mediaDrafts.length, t]);

  // Anexa mídia escolhida pela câmera/galeria. A biblioteca aceita seleção
  // múltipla; câmera permanece uma captura por vez.
  const pickMessageMedia = useCallback(async (source: 'camera' | 'library') => {
    setMediaError(null);
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setMediaError(
          source === 'camera' ? t('messages.chat.cameraPermission') : t('messages.chat.mediaPermission'),
        );
        return;
      }
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images', 'videos'],
              quality: 0.7,
              allowsMultipleSelection: true,
              selectionLimit: Math.max(1, MAX_MESSAGE_MEDIA - mediaDrafts.length),
            });
      if (res.canceled) return;
      await addMediaAssets(res.assets);
    } catch {
      setMediaError(t('messages.chat.mediaLoadError'));
    }
  }, [t, mediaDrafts.length, addMediaAssets]);

  // O React Native Web não encaminha arquivos colados pelo onChangeText.
  // Lemos o ClipboardEvent enquanto o composer está focado e transformamos
  // cada imagem em uma URL local compatível com o upload existente.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onPaste = (event: ClipboardEvent) => {
      if (!composerFocusedRef.current) return;
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
        file.type.startsWith('image/'),
      );
      if (!files.length) return;
      event.preventDefault();
      void addMediaAssets(files.map((file) => ({
        uri: URL.createObjectURL(file),
        type: 'image' as const,
        mimeType: file.type,
        fileName: file.name || 'clipboard-image',
      })));
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [addMediaAssets]);

  // No desktop web, abre o seletor diretamente: o atributo `capture` usado
  // pelo expo-image-picker não garante acesso à webcam nesses navegadores.
  const openAttach = useCallback(() => {
    setMediaError(null);
    if (isDesktopWeb) {
      void pickMessageMedia('library');
      return;
    }
    setAttachMenuVisible(true);
  }, [isDesktopWeb, pickMessageMedia]);

  const send = useCallback(async () => {
    const content = input.trim();
    const media = mediaDrafts.flatMap((draft) =>
      draft.url ? [{ url: draft.url, type: draft.type }] : [],
    );
    const uploading = mediaDrafts.some((draft) => draft.uploading);
    if ((!content && !media.length) || !id || sending || uploading) return;
    const replyToId = replyingTo?.id;
    setSending(true);
    setInput('');
    setInputHeight(CHAT_INPUT_MIN_HEIGHT);
    setReplyingTo(null);
    setMediaDrafts([]);
    try {
      const msg =
        kind === 'dm'
          ? await api.sendMessage(id, content, undefined, replyToId, undefined, undefined, undefined, undefined, media)
          : await api.sendGroupMessage(id, content, replyToId, undefined, undefined, media);
      trackClick(kind === 'dm' ? 'send_message' : 'send_group_message');
      setMessages((prev) => [...prev, msg]);
      animateEntrance([msg.id]);
      onActivity?.();
    } catch {
      setInput(content);
      setReplyingTo(replyingTo ?? null);
      setMediaDrafts(mediaDrafts);
    } finally {
      setSending(false);
    }
  }, [input, id, kind, sending, onActivity, animateEntrance, replyingTo, mediaDrafts]);

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
    const next = Math.min(Math.max(node.scrollHeight, CHAT_INPUT_MIN_HEIGHT), CHAT_INPUT_MAX_HEIGHT);
    node.style.height = `${next}px`;
    setInputHeight(next);
    // `loading` nas deps: enquanto a tela mostra o spinner, o composer (e o
    // ref) nem existe ainda — sem reagir à troca pra `false`, esse ajuste só
    // rodava na próxima tecla digitada, deixando o campo "grudado" em 2
    // linhas (56px) até lá, mesmo com o `height` certo já declarado no style.
  }, [input, kind, loading]);

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

  // Candidatos a menção: só existe em grupo (DM não tem @menção — ver
  // composer abaixo), e só os membros — vazio até o grupo carregar.
  const mentionCandidates = useMemo<User[]>(
    () => group?.members.map((m) => m.user) ?? [],
    [group],
  );

  const onChangeInput = useCallback(
    (v: string) => {
      setInput(v);
      if (v.trim() && id) pingTyping({ kind, id });
    },
    [id, kind, pingTyping],
  );

  const onInputContentSizeChange = useCallback(
    (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      // Na web quem manda é o useLayoutEffect acima (precisa zerar a altura
      // antes de medir pra conseguir encolher); aqui só nativo.
      if (Platform.OS === 'web') return;
      setInputHeight(
        Math.min(
          Math.max(e.nativeEvent.contentSize.height, CHAT_INPUT_MIN_HEIGHT),
          CHAT_INPUT_MAX_HEIGHT,
        ),
      );
    },
    [],
  );

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

  // Abre as configurações da conversa/grupo (inclui "Notificações" — ver
  // NotificationMuteRow) em vez de ir direto pro perfil do destinatário.
  const openInfo = () => {
    if (kind === 'dm' && other) router.push(`/messages/${other.username}/info` as any);
    else if (kind === 'group' && group) router.push(`/groups/${group.publicId}/info` as any);
  };

  const headerName = kind === 'dm' ? other?.name : group?.name;
  const headerAvatar = kind === 'dm' ? other?.avatar : group?.avatar;

  const headerSub =
    kind === 'dm'
    ? other?.neighborhood
    : group
    ? `${t('messages.memberCount', { count: group.membersCount })} · ${t(`groups.privacy.${group.privacy}.short`)}`
    : '';

  return (
    <View style={styles.flex}>
      {/* Cabeçalho da conversa */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.headerUser}
          activeOpacity={0.7}
          onPress={openInfo}
          {...({ tabIndex: -1 } as any)}
        >
          {headerAvatar ? (
            <Image source={{ uri: headerAvatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarGroup]}>
              <Ionicons name="people" size={20} color={Colors.primary} />
            </View>
          )}
          <View style={styles.flex}>
            <Text style={styles.headerName} numberOfLines={1}>
              {headerName ?? (kind === 'group' ? t('messages.group') : t('messages.conversation'))}
            </Text>
            {!!headerSub && (
              <Text style={styles.headerSub} numberOfLines={1}>{headerSub}</Text>
            )}
          </View>
        </TouchableOpacity>
        {/* Configurações da conversa/grupo (inclui "Notificações") — mesmo
            destino de tocar no nome/avatar acima, só que sempre visível. */}
        <TouchableOpacity style={styles.backBtn} onPress={openInfo}>
          <Ionicons name="information-circle-outline" size={24} color={Colors.text} />
        </TouchableOpacity>
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
                  linkMentions={kind === 'group'}
                  onReply={setReplyingTo}
                  onJumpTo={jumpToMessage}
                  onViewMedia={(m) =>
                    setViewerMedia({ media: m.media, index: 0 })
                  }
                  styles={styles}
                />
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={44} color={Colors.textTertiary} />
                <Text style={styles.emptyText}>
                  {kind === 'group'
                    ? t('messages.chat.groupEmpty')
                    : t('messages.chat.dmEmpty', { name: other?.name?.split(' ')[0] ?? t('messages.chat.yourNeighbor') })}
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
                  {t('messages.chat.replyingTo', { name: replyingTo.sender.name })}
                </Text>
                <Text style={styles.replyBarText} numberOfLines={1}>
                  {replyingTo.content || t('messages.chat.sharedPost')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={8}>
                <Ionicons name="close" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Prévia das mídias preparadas — clicáveis no mesmo visualizador
              usado pelas mensagens já enviadas. */}
          {mediaDrafts.length > 0 && (
            <ScrollView
              horizontal
              style={styles.mediaPreviewScroller}
              contentContainerStyle={styles.mediaPreviewRow}
              showsHorizontalScrollIndicator={false}
            >
              {mediaDrafts.map((draft, index) => (
                <Pressable
                  key={draft.id}
                  style={styles.mediaPreviewWrap}
                  onPress={() => !draft.uploading && setViewerMedia({
                    media: mediaDrafts.map((item) => ({ url: item.localUri, type: item.type })),
                    index,
                  })}
                  onHoverIn={() => setHoveredDraftId(draft.id)}
                  onHoverOut={() => setHoveredDraftId(null)}
                >
                  {draft.type === 'video' ? (
                    <View style={[styles.mediaPreview, styles.mediaPreviewVideo]}>
                      <Ionicons name="videocam" size={20} color="#fff" />
                    </View>
                  ) : (
                    <Image source={{ uri: draft.localUri }} style={styles.mediaPreview} resizeMode="cover" />
                  )}
                  {draft.uploading && (
                    <View style={styles.mediaPreviewOverlay}>
                      <ActivityIndicator color="#fff" size="small" />
                    </View>
                  )}
                  <View
                    style={[
                      styles.mediaPreviewRemoveWrap,
                      Platform.OS === 'web' && hoveredDraftId !== draft.id && styles.mediaPreviewRemoveHidden,
                    ]}
                    pointerEvents="box-none"
                  >
                    <Pressable
                      style={styles.mediaPreviewRemove}
                      onHoverIn={() => setHoveredDraftId(draft.id)}
                      onPress={(event) => {
                        event.stopPropagation();
                        if (!draft.uploading) {
                          setMediaDrafts((items) => items.filter((item) => item.id !== draft.id));
                        }
                      }}
                      hitSlop={4}
                    >
                      <Ionicons name="close" size={15} color="#fff" />
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {!!mediaError && <Text style={styles.mediaErrorText}>{mediaError}</Text>}

          {/* Composer — @menção só existe em grupos (só membros podem ser
              mencionados; numa DM já é só o outro participante, sem sentido). */}
          <View style={styles.composer}>
            {kind === 'group' ? (
              <MentionInput
                inputRef={inputRef}
                containerStyle={styles.inputWrap}
                style={[styles.input, styles.inputInner, { height: inputHeight }]}
                dropdownDirection="up"
                candidates={mentionCandidates}
                placeholder={t('messages.chat.groupPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                value={input}
                onChangeText={onChangeInput}
                onFocus={() => { composerFocusedRef.current = true; }}
                onBlur={() => { composerFocusedRef.current = false; }}
                multiline
                onContentSizeChange={onInputContentSizeChange}
                onKeyPress={submitOnEnter(send)}
                onSubmitEditing={send}
              />
            ) : (
              <TextInput
                ref={inputRef}
                style={[styles.input, styles.inputWrap, { height: inputHeight }]}
                placeholder={t('messages.chat.placeholder')}
                placeholderTextColor={Colors.textTertiary}
                value={input}
                onChangeText={onChangeInput}
                onFocus={() => { composerFocusedRef.current = true; }}
                onBlur={() => { composerFocusedRef.current = false; }}
                multiline
                onContentSizeChange={onInputContentSizeChange}
                onKeyPress={submitOnEnter(send)}
                onSubmitEditing={send}
              />
            )}
            <TouchableOpacity style={styles.attachBtn} onPress={openAttach} hitSlop={8}>
              <Ionicons name="image-outline" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sendBtn,
                ((!input.trim() && !mediaDrafts.some((draft) => draft.url)) || sending || mediaDrafts.some((draft) => draft.uploading)) && styles.sendBtnDisabled,
              ]}
              onPress={send}
              disabled={(!input.trim() && !mediaDrafts.some((draft) => draft.url)) || sending || mediaDrafts.some((draft) => draft.uploading)}
              activeOpacity={0.85}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <ActionMenu
        visible={attachMenuVisible}
        onClose={() => setAttachMenuVisible(false)}
        options={[
          {
            key: 'camera',
            label: t('messages.chat.takePhoto'),
            icon: 'camera-outline',
            onPress: () => pickMessageMedia('camera'),
          },
          {
            key: 'library',
            label: t('messages.chat.chooseFromLibrary'),
            icon: 'image-outline',
            onPress: () => pickMessageMedia('library'),
          },
        ]}
      />
      <ImageViewerModal
        visible={!!viewerMedia}
        media={viewerMedia?.media ?? []}
        initialIndex={viewerMedia?.index ?? 0}
        onClose={() => setViewerMedia(null)}
      />
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
  // bubbleRow usa alignItems:"flex-end" (não stretch), então já fica do
  // tamanho do conteúdo — só falta o borderRadius pro hover não vazar quadrado.
  senderAvatarBtn: { borderRadius: 9 },
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
  mediaWrap: { marginBottom: 2 },
  messageMediaGrid: { width: 220, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  messageMediaCell: { width: 108, height: 108 },
  messageMedia: { width: 220, height: 220, borderRadius: 14, backgroundColor: Colors.border },
  messageMediaGridItem: { width: 108, height: 108, borderRadius: 10 },
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
  // Menção dentro do balão "meu" (fundo colorido): mantém legível.
  bubbleMention: { color: '#fff', fontWeight: '700', textDecorationLine: 'underline' },
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
  mediaPreviewScroller: {
    flexGrow: 0,
    height: 84,
    backgroundColor: Colors.surface,
  },
  mediaPreviewRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
    alignItems: 'center',
  },
  mediaPreviewWrap: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaPreview: { width: 64, height: 64, borderRadius: 12, backgroundColor: Colors.border },
  mediaPreviewVideo: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E293B' },
  mediaPreviewOverlay: {
    position: 'absolute',
    inset: 0,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  } as any,
  mediaPreviewRemoveWrap: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
  },
  mediaPreviewRemoveHidden: { opacity: 0 },
  mediaPreviewRemove: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaErrorText: {
    fontSize: 12,
    color: Colors.error,
    paddingHorizontal: 16,
    paddingTop: 6,
    backgroundColor: Colors.surface,
  },
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
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    lineHeight: CHAT_INPUT_LINE_HEIGHT,
    color: Colors.text,
    outlineStyle: 'none',
  } as any,
  // Ocupa a vaga flex:1 da linha do composer — no DM, direto no TextInput
  // (linha); no grupo, no wrapper que o MentionInput monta em volta do campo
  // (View, que por padrão empilha em coluna — outro eixo, outra história).
  inputWrap: { flex: 1 },
  // Dentro do wrapper de coluna do MentionInput, o eixo principal do campo
  // passa a ser a ALTURA — herdar o "flex:1" de `styles.input` (que ali era
  // só sobre largura, no eixo do composer) faria esse `flex-basis:0%` reger
  // a altura em vez do `height` explícito, e o campo travava do tamanho
  // mínimo automático do flex item (o `rows` nativo do textarea, 2 linhas).
  // flexGrow/flexShrink (não o shorthand "flex: 0", que tem o mesmo problema
  // do flex:1 — seta flex-basis:0%) zera isso sem tocar no eixo de largura.
  inputInner: { flexGrow: 0, flexShrink: 0, alignSelf: 'stretch' },
  // Mesma caixa 40×40 do sendBtn (não só padding) — com alignItems:"flex-end"
  // na linha do composer, caixas de altura diferente ficam com o topo
  // desalinhado; do mesmo tamanho, os dois ícones ficam na mesma altura.
  attachBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
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
