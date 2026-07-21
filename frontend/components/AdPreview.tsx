import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Line, Path, Circle } from 'react-native-svg';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles, useThemeMode } from '../lib/theme';
import { AdFormat, Ad } from '../lib/adsApi';
import { CreativeBlocks, CreativeBlockDraft } from './AdCreativeEditor';
import AdPostCard from './AdPostCard';
import AdSearchPoster from './AdSearchPoster';

// Preview ao vivo do anúncio — mostra, lado a lado com o editor, um "recorte"
// de como o conteúdo vai aparecer em cada superfície escolhida (Feed, mapa,
// Busca, Mensagens, Novidades). Para ser fiel, o ANÚNCIO é renderizado pelos
// mesmos componentes reais do app (AdPostCard/AdSearchPoster e a mesma
// marcação das linhas de Mensagens/Novidades), dentro de um wrapper
// `pointerEvents="none"` (puramente visual: nenhum toque abre link nem
// registra clique). Ao redor dele ficam alguns itens de exemplo (posts/linhas
// fictícios, só texto, sem imagens pra não roubar a atenção) só pra dar
// contexto de como o anúncio aparece no meio do conteúdo comum. Atualiza em
// tempo real conforme o anunciante digita.

// Resolve o conteúdo de cada superfície pela mesma cascata do backend
// (`pick_creative`): usa o bloco específico do formato se existir, senão o base.
function effectiveDraft(blocks: CreativeBlocks, format: AdFormat): CreativeBlockDraft {
  return (blocks as unknown as Record<string, CreativeBlockDraft | undefined>)[format] ?? blocks.default;
}

// Monta um `Ad` (formato que os componentes reais consomem) a partir do draft.
// Campos vazios viram texto de exemplo pra prévia nunca ficar em branco.
function draftToAd(draft: CreativeBlockDraft, id: number): Ad {
  return {
    id,
    creativeId: id,
    objective: 'clicks',
    title: draft.title || 'Título do anúncio',
    content: draft.content || 'O texto do seu anúncio aparece aqui.',
    imageUrl: draft.mediaType === 'image' && draft.mediaUrl ? draft.mediaUrl : undefined,
    videoUrl: draft.mediaType === 'video' && draft.mediaUrl ? draft.mediaUrl : undefined,
    ctaLabel: draft.ctaLabel || undefined,
    targetUrl: draft.targetUrl || '#',
    latitude: draft.latitude ? Number(draft.latitude) : undefined,
    longitude: draft.longitude ? Number(draft.longitude) : undefined,
    linkedUserId: draft.linkedUserId,
  };
}

// Itens de exemplo ao redor do anúncio (só texto, sem imagem). Avatares são
// círculos com a inicial — elementos de verdade, discretos, sem foto.
const FAKE_POSTS = [
  { name: 'Marina Alves', username: 'marinaa', neighborhood: 'Pinheiros', time: '2h',
    text: 'Alguém sabe que horas abre a feira de rua no sábado? Quero garantir os pastéis 😋', likes: 34, comments: 12 },
  { name: 'Carlos Nunes', username: 'carlosnunes', neighborhood: 'Vila Madalena', time: '5h',
    text: 'Vendo bicicleta seminova, super conservada. Chama no direct quem tiver interesse!', likes: 18, comments: 5 },
];
const FAKE_CHATS = [
  { name: 'Vizinhos do Bairro', last: 'Ana: bom dia! alguém indica um encanador?', time: '09:12' },
  { name: 'Roberto Lima', last: 'Combinado, te espero às 18h 👍', time: 'ontem' },
];
const FAKE_NOTIFS = [
  { name: 'Juliana Prado', action: 'curtiu sua publicação', time: '1h' },
  { name: 'Pedro Alves', action: 'comentou: "que legal, vou lá!"', time: '3h' },
];
const SEARCH_CHIPS = ['Eventos', 'Vendas', 'Serviços', 'Segurança'];

export default function AdPreview({ formats, blocks }: { formats: AdFormat[]; blocks: CreativeBlocks }) {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();

  const hasPost = formats.includes('post');
  const hasSearch = formats.includes('search_poster');
  const hasConversation = formats.includes('conversation');
  const hasNotification = formats.includes('notification');

  if (!hasPost && !hasSearch && !hasConversation && !hasNotification) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.previewHeading}>Prévia ao vivo</Text>
      <Text style={styles.previewSub}>Assim seu anúncio aparece em cada lugar.</Text>

      {hasPost && (
        <Frame label="No feed" icon="newspaper-outline" flush styles={styles}>
          <FakePost post={FAKE_POSTS[0]} styles={styles} />
          <View pointerEvents="none">
            <AdPostCard ad={draftToAd(effectiveDraft(blocks, 'post'), 1)} />
          </View>
          <FakePost post={FAKE_POSTS[1]} styles={styles} />
        </Frame>
      )}
      {hasPost && (
        <Frame label="No mapa" icon="location-outline" styles={styles}>
          <MapPreview draft={effectiveDraft(blocks, 'post')} styles={styles} />
        </Frame>
      )}
      {hasSearch && (
        <Frame label="Na Busca" icon="search-outline" styles={styles}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={Colors.textTertiary} />
            <Text style={styles.searchPlaceholder}>Buscar no bairro…</Text>
          </View>
          <View style={styles.chipsRow}>
            {SEARCH_CHIPS.map((c) => (
              <View key={c} style={styles.catChip}><Text style={styles.catChipText}>{c}</Text></View>
            ))}
          </View>
          <View pointerEvents="none">
            <AdSearchPoster ad={draftToAd(effectiveDraft(blocks, 'search_poster'), 2)} />
          </View>
        </Frame>
      )}
      {hasConversation && (
        <Frame label="Em Mensagens" icon="chatbubbles-outline" flush styles={styles}>
          <ConversationAdRow draft={effectiveDraft(blocks, 'conversation')} styles={styles} />
          {FAKE_CHATS.map((c) => (
            <View key={c.name}>
              <View style={styles.divider} />
              <FakeChatRow chat={c} styles={styles} />
            </View>
          ))}
        </Frame>
      )}
      {hasNotification && (
        <Frame label="Nas Novidades" icon="notifications-outline" flush styles={styles}>
          <NotificationAdRow draft={effectiveDraft(blocks, 'notification')} styles={styles} />
          {FAKE_NOTIFS.map((n) => (
            <View key={n.name}>
              <View style={styles.divider} />
              <FakeNotifRow notif={n} styles={styles} />
            </View>
          ))}
        </Frame>
      )}
    </View>
  );
}

function Frame({ label, icon, flush, styles, children }: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  flush?: boolean;
  styles: ReturnType<typeof makeStyles>;
  children: React.ReactNode;
}) {
  const Colors = useTheme();
  return (
    <View style={styles.frame}>
      <View style={styles.frameCaption}>
        <Ionicons name={icon} size={13} color={Colors.textTertiary} />
        <Text style={styles.frameCaptionText}>{label}</Text>
      </View>
      <View style={flush ? styles.frameBodyFlush : styles.frameBody}>{children}</View>
    </View>
  );
}

// Círculo com a inicial — avatar discreto sem imagem (para os itens de exemplo).
function InitialAvatar({ name, size, styles }: { name: string; size: number; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={[styles.initialAvatar, { width: size, height: size, borderRadius: size * 0.34 }]}>
      <Text style={styles.initialAvatarText}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// ── Mapa (fundo genérico de mapa + pin do anúncio no centro) ─────────────
interface MapColors { land: string; block: string; road: string; roadMinor: string; park: string; water: string; marker: string }
const LIGHT_MAP: MapColors = { land: '#E9EDE6', block: '#DCE2D8', road: '#FFFFFF', roadMinor: '#F1F4EE', park: '#CBE3C4', water: '#BAD3EA', marker: '#9AA6B2' };
const DARK_MAP: MapColors = { land: '#232A32', block: '#2B333C', road: '#3B434D', roadMinor: '#333B45', park: '#2E4433', water: '#294055', marker: '#5B6875' };

// Quadras (retângulos de "quarteirões") — posições fixas só pra dar aparência
// de mapa; o pin do anúncio fica sempre no centro por cima.
const MAP_BLOCKS: [number, number, number, number][] = [
  [12, 10, 40, 18], [62, 12, 30, 16], [14, 36, 28, 20], [54, 38, 38, 20],
  [166, 10, 40, 18], [216, 10, 46, 22], [272, 14, 36, 18], [166, 38, 46, 20],
  [12, 80, 32, 18], [52, 82, 40, 16], [12, 106, 46, 16], [64, 106, 32, 16],
  [252, 80, 42, 16],
];
const MAP_MARKERS: [number, number][] = [[70, 30], [244, 66], [104, 100]];

function MapArt({ c }: { c: MapColors }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 130" preserveAspectRatio="xMidYMid slice">
      <Rect x="0" y="0" width="320" height="130" fill={c.land} />
      {/* Rio */}
      <Path d="M -20 22 Q 80 52 150 44 T 340 78" stroke={c.water} strokeWidth="15" fill="none" strokeLinecap="round" />
      {/* Parques */}
      <Rect x="176" y="82" width="60" height="40" rx="7" fill={c.park} />
      <Rect x="24" y="12" width="44" height="26" rx="5" fill={c.park} opacity={0.9} />
      {/* Quadras */}
      {MAP_BLOCKS.map(([x, y, w, h], i) => (
        <Rect key={i} x={x} y={y} width={w} height={h} rx="3" fill={c.block} />
      ))}
      {/* Vias secundárias */}
      <Line x1="0" y1="30" x2="320" y2="30" stroke={c.roadMinor} strokeWidth="5" />
      <Line x1="0" y1="100" x2="320" y2="100" stroke={c.roadMinor} strokeWidth="5" />
      <Line x1="70" y1="0" x2="70" y2="130" stroke={c.roadMinor} strokeWidth="5" />
      <Line x1="244" y1="0" x2="244" y2="130" stroke={c.roadMinor} strokeWidth="5" />
      {/* Vias principais */}
      <Line x1="0" y1="20" x2="320" y2="110" stroke={c.road} strokeWidth="6" />
      <Line x1="0" y1="66" x2="320" y2="66" stroke={c.road} strokeWidth="10" />
      <Line x1="150" y1="0" x2="150" y2="130" stroke={c.road} strokeWidth="10" />
      {/* Outros locais (marcadores discretos) */}
      {MAP_MARKERS.map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r="3.5" fill={c.marker} />
      ))}
    </Svg>
  );
}

function MapPreview({ draft, styles }: { draft: CreativeBlockDraft; styles: ReturnType<typeof makeStyles> }) {
  const Colors = useTheme();
  const { mode } = useThemeMode();
  return (
    <View style={styles.mapCanvas}>
      <View style={StyleSheet.absoluteFill}>
        <MapArt c={mode === 'dark' ? DARK_MAP : LIGHT_MAP} />
      </View>
      <View style={styles.mapPinCenter}>
        <View style={styles.mapPinBubble}>
          <View style={styles.mapPinIcon}><Ionicons name="megaphone" size={14} color="#fff" /></View>
          <Text style={styles.mapPinText} numberOfLines={1}>{draft.title || 'Seu anúncio'}</Text>
        </View>
        <Ionicons name="location" size={26} color={Colors.primary} style={styles.mapPinDrop} />
      </View>
    </View>
  );
}

// ── Mensagens (mesma marcação da AdInboxRow real) ────────────────────────
function ConversationAdRow({ draft, styles }: { draft: CreativeBlockDraft; styles: ReturnType<typeof makeStyles> }) {
  const Colors = useTheme();
  const img = draft.mediaType === 'image' ? draft.mediaUrl : '';
  return (
    <View style={styles.msgRow}>
      {img ? (
        <Image source={{ uri: img }} style={styles.msgAvatar} />
      ) : (
        <View style={[styles.msgAvatar, styles.msgAvatarIcon]}>
          <Ionicons name="megaphone" size={22} color={Colors.accent} />
        </View>
      )}
      <View style={styles.msgContent}>
        <View style={styles.msgHeader}>
          <View style={styles.nameRow}>
            <Text style={styles.msgName} numberOfLines={1}>{draft.title || 'Título do anúncio'}</Text>
          </View>
          <Text style={styles.msgTime}>Anúncio</Text>
        </View>
        <Text style={styles.msgPreview} numberOfLines={1}>{draft.content || 'Texto do anúncio'}</Text>
      </View>
    </View>
  );
}

// ── Novidades (mesma marcação da notificação sintética real) ─────────────
function NotificationAdRow({ draft, styles }: { draft: CreativeBlockDraft; styles: ReturnType<typeof makeStyles> }) {
  const Colors = useTheme();
  const img = draft.mediaType === 'image' ? draft.mediaUrl : '';
  return (
    <View style={styles.notifRow}>
      {img ? (
        <View style={styles.notifAvatarWrapper}>
          <Image source={{ uri: img }} style={styles.notifAvatar} />
          <View style={[styles.notifTypeBadge, { backgroundColor: Colors.accentLight }]}>
            <Ionicons name="megaphone" size={10} color={Colors.accent} />
          </View>
        </View>
      ) : (
        <View style={[styles.notifIconBox, { backgroundColor: Colors.accentLight }]}>
          <Ionicons name="megaphone" size={20} color={Colors.accent} />
        </View>
      )}
      <View style={styles.notifContent}>
        <Text style={styles.notifText} numberOfLines={2}>{draft.title || 'Título do anúncio'}</Text>
        <Text style={styles.notifTime}>Publicidade</Text>
      </View>
    </View>
  );
}

// ── Itens de exemplo (fake, sem imagem) ──────────────────────────────────
function FakePost({ post, styles }: { post: typeof FAKE_POSTS[number]; styles: ReturnType<typeof makeStyles> }) {
  const Colors = useTheme();
  return (
    <View style={styles.realCard}>
      <View style={styles.realHeader}>
        <InitialAvatar name={post.name} size={38} styles={styles} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.realName} numberOfLines={1}>{post.name}</Text>
          <Text style={styles.realMeta} numberOfLines={1}>@{post.username} · {post.neighborhood} · {post.time}</Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={16} color={Colors.textTertiary} />
      </View>
      <Text style={styles.realBody} numberOfLines={3}>{post.text}</Text>
      <View style={styles.realFooter}>
        <View style={styles.realStat}>
          <Ionicons name="heart-outline" size={15} color={Colors.textTertiary} />
          <Text style={styles.realStatText}>{post.likes}</Text>
        </View>
        <View style={styles.realStat}>
          <Ionicons name="chatbubble-outline" size={14} color={Colors.textTertiary} />
          <Text style={styles.realStatText}>{post.comments}</Text>
        </View>
        <Ionicons name="share-social-outline" size={15} color={Colors.textTertiary} />
      </View>
    </View>
  );
}

function FakeChatRow({ chat, styles }: { chat: typeof FAKE_CHATS[number]; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.msgRow}>
      <InitialAvatar name={chat.name} size={52} styles={styles} />
      <View style={styles.msgContent}>
        <View style={styles.msgHeader}>
          <View style={styles.nameRow}>
            <Text style={styles.msgName} numberOfLines={1}>{chat.name}</Text>
          </View>
          <Text style={styles.msgTime}>{chat.time}</Text>
        </View>
        <Text style={styles.msgPreview} numberOfLines={1}>{chat.last}</Text>
      </View>
    </View>
  );
}

function FakeNotifRow({ notif, styles }: { notif: typeof FAKE_NOTIFS[number]; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.notifRow}>
      <InitialAvatar name={notif.name} size={48} styles={styles} />
      <View style={styles.notifContent}>
        <Text style={styles.notifText} numberOfLines={2}>
          <Text style={styles.notifBold}>{notif.name}</Text> {notif.action}
        </Text>
        <Text style={styles.notifTime}>{notif.time}</Text>
      </View>
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  wrap: { gap: 12 },
  previewHeading: { fontSize: 14, fontWeight: '800', color: Colors.text },
  previewSub: { fontSize: 12, color: Colors.textTertiary, marginTop: -6 },

  frame: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  frameCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  frameCaptionText: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  frameBody: { padding: 10 },
  // Flush: itens de largura total encostados (feed/mensagens/novidades), como
  // nas listas reais do app, separados por uma linha fina.
  frameBodyFlush: { backgroundColor: Colors.surface },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },

  // Avatar de inicial (itens de exemplo — sem imagem)
  initialAvatar: { backgroundColor: Colors.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  initialAvatarText: { fontSize: 15, fontWeight: '800', color: Colors.primary },

  // Busca — barra + chips de categoria (contexto real, com texto)
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
  },
  searchPlaceholder: { fontSize: 13, color: Colors.textTertiary },
  chipsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  catChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  // Mapa
  mapCanvas: {
    height: 130, borderRadius: 10, backgroundColor: Colors.borderLight,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  mapPinCenter: { alignItems: 'center', justifyContent: 'center' },
  mapPinBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '85%',
    paddingLeft: 4, paddingRight: 12, paddingVertical: 4, borderRadius: 999,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  mapPinIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  mapPinText: { fontSize: 12, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  mapPinDrop: { marginTop: -2 },

  // Feed — posts de exemplo (mesma silhueta do PostCard, sem imagem)
  realCard: {
    backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  realHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  realName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  realMeta: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500', marginTop: 1 },
  realBody: { fontSize: 14, color: Colors.text, lineHeight: 20, marginBottom: 10 },
  realFooter: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  realStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  realStatText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '600' },

  // Mensagens (estilos idênticos aos de messages.tsx)
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: Colors.surface },
  msgAvatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.borderLight },
  msgAvatarIcon: { backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  msgContent: { flex: 1, minWidth: 0 },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 },
  msgName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  msgTime: { fontSize: 12, color: Colors.textTertiary },
  msgPreview: { fontSize: 13, color: Colors.textSecondary, flex: 1 },

  // Novidades (estilos idênticos aos de notifications.tsx)
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: Colors.surface },
  notifAvatarWrapper: { position: 'relative' },
  notifAvatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.borderLight },
  notifTypeBadge: {
    position: 'absolute', bottom: -3, right: -3, width: 20, height: 20, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.surface,
  },
  notifIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1 },
  notifText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  notifBold: { fontWeight: '800', color: Colors.text },
  notifTime: { fontSize: 12, color: Colors.textTertiary, marginTop: 3 },
});
