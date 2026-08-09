import { Platform } from 'react-native';
import { getItem, removeItem, setItem } from './storage';
import { Poll, Post, PostCategory, PostMedia, User } from '../data/mock';
import { activeLocale } from './time';

// ─────────────────────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────────────────────
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ??
  'http://localhost:8000/api/v1';

export type SearchType = 'all' | 'posts' | 'users';

const TOKEN_KEY = 'daqui.token';

let token: string | null = null;
// Promise memoizada da primeira leitura do storage. Existe para que `request`
// possa aguardar o token estar carregado mesmo quando uma tela dispara sua
// própria busca de dados antes do efeito de bootstrap do AuthProvider
// terminar (acontece em navegação direta/refresh — sem isso, a 1ª chamada
// sai sem Authorization e o backend responde 403).
let tokenReady: Promise<void> | null = null;

function ensureTokenLoaded(): Promise<void> {
  if (!tokenReady) {
    const p = getItem(TOKEN_KEY).then((stored) => {
      if (tokenReady === p) token = stored;
    });
    tokenReady = p;
  }
  return tokenReady;
}

export async function loadToken(): Promise<string | null> {
  await ensureTokenLoaded();
  return token;
}

export async function setToken(value: string | null): Promise<void> {
  token = value;
  tokenReady = Promise.resolve();
  if (value) await setItem(TOKEN_KEY, value);
  else await removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return token;
}

// URL do WebSocket de tempo real (mensagens/notificações), já com o token
// atual. Retorna null se não houver sessão — quem chama deve tratar esse caso.
export function getRealtimeUrl(): string | null {
  if (!token) return null;
  return `${API_URL.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`;
}

// ─────────────────────────────────────────────────────────────
// HTTP helper
// ─────────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Chamado quando o backend responde 423 (conta suspensa): a sessão deve ser
// encerrada na hora, com um aviso. Registrado pelo AuthProvider.
type ForceLogoutHandler = (message: string) => void;
let forceLogoutHandler: ForceLogoutHandler | null = null;
export function setForceLogoutHandler(handler: ForceLogoutHandler | null): void {
  forceLogoutHandler = handler;
}
// Também chamado pelo WS ao receber `forced_logout` (ver lib/realtime.tsx) —
// mesma suspensão, dois gatilhos possíveis (request HTTP ou push do socket).
export function triggerForceLogout(message: string): void {
  forceLogoutHandler?.(message);
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message)) || `Erro ${res.status}`;
    const message = typeof detail === 'string' ? detail : 'Erro';
    if (res.status === 423) triggerForceLogout(message);
    throw new ApiError(res.status, message);
  }
  return data as T;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  if (auth) await ensureTokenLoaded();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor.');
  }

  return handleResponse<T>(res);
}

// Upload multipart (imagem/vídeo) — não usa o `request` acima porque o
// Content-Type (com boundary) precisa ser definido pelo próprio fetch a
// partir do FormData, não fixado como "application/json".
export interface PickedMediaAsset {
  uri: string;
  mimeType?: string;
  fileName?: string;
}

async function buildMediaFormData(asset: PickedMediaAsset): Promise<FormData> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(asset.uri)).blob();
    formData.append('file', blob, asset.fileName || 'upload');
  } else {
    formData.append('file', {
      uri: asset.uri,
      name: asset.fileName || 'upload',
      type: asset.mimeType || 'application/octet-stream',
    } as any);
  }
  return formData;
}

async function requestMultipart<T>(
  path: string,
  formData: FormData,
  options: { auth?: boolean } = {},
): Promise<T> {
  const { auth = true } = options;
  if (auth) await ensureTokenLoaded();
  const headers: Record<string, string> = {};
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor.');
  }

  return handleResponse<T>(res);
}

// ─────────────────────────────────────────────────────────────
// Tipos do backend (snake_case)
// ─────────────────────────────────────────────────────────────
interface BackendUser {
  id: number;
  username: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url?: string | null;
  neighborhood: string;
  city?: string | null;
  state?: string | null;
  badge: string | null;
  verified: boolean;
  posts_count: number;
  interactions_count: number;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  locked?: boolean;
  email?: string;
  two_factor_enabled?: boolean;
  pending_notice?: string | null;
  show_location?: boolean;
  searchable?: boolean;
  hide_resident_badge?: boolean;
  notify_likes?: boolean;
  notify_comments?: boolean;
  notify_messages?: boolean;
  notify_neighborhood_alerts?: boolean;
  include_nearby?: boolean;
}

interface BackendImportantQuota {
  used: number;
  limit: number;
  remaining: number;
  resets_at: string;
}

interface BackendPollOption {
  id: number;
  text: string;
  votes_count: number;
}

interface BackendPoll {
  multiple: boolean;
  closes_at: string;
  closed: boolean;
  total_votes: number;
  options: BackendPollOption[];
  my_votes: number[];
}

interface BackendPostMedia {
  url: string;
  type: 'image' | 'video';
}

interface BackendPost {
  id: number;
  // Identificador de URL (estilo Twitter, opaco) — ver backend models/post.py::public_id.
  public_id: string;
  category: string;
  title: string | null;
  content: string;
  media: BackendPostMedia[];
  image_urls: string[];
  details: Record<string, any> | null;
  neighborhood: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  important: boolean;
  pinned: boolean;
  created_at: string;
  author: BackendUser;
  author_is_resident: boolean;
  liked: boolean;
  reposted: boolean;
  quoted_post: BackendSharedPost | null;
  quoted_comment: BackendSharedComment | null;
  quoted_ad_id: number | null;
  reposted_by: BackendUser | null;
  reposted_at: string | null;
  poll: BackendPoll | null;
}

interface BackendComment {
  id: number;
  post_id: number;
  post_public_id: string | null;
  post_author_username: string | null;
  parent_id: number | null;
  content: string;
  image_url: string | null;
  created_at: string;
  author: BackendUser;
  author_is_resident: boolean;
  likes_count: number;
  liked: boolean;
  reposts_count: number;
  reposted: boolean;
  replies_count: number;
}

interface BackendSession {
  id: number;
  device_name: string;
  created_at: string;
  is_current: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  // Post pai, pra montar o link `/{username}/post/{postPublicId}` sem
  // expor `postId` (ausentes no raro caso de post pai já apagado).
  postPublicId?: string;
  postAuthorUsername?: string;
  parentId?: string; // comentário respondido (thread); ausente = comentário de topo
  content: string;
  imageUrl?: string; // foto anexada (opcional; comentário pode ser só imagem)
  createdAt: string;
  author: User;
  authorIsResident: boolean; // autor mora no bairro do post comentado (selo de Morador)
  likesCount: number;
  liked: boolean;
  repostsCount: number;
  reposted: boolean; // repost simples (sem citação) pelo usuário logado
  repliesCount: number; // respostas diretas (carregadas sob demanda)
}

export interface UserSession {
  id: string;
  deviceName: string;
  createdAt: string;
  isCurrent: boolean;
}

interface BackendConversation {
  user: BackendUser;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  is_muted: boolean;
  muted_until: string | null;
}

interface BackendSharedPost {
  id: number;
  public_id: string;
  category: string;
  title: string | null;
  content: string;
  image_urls: string[];
  created_at: string;
  author: BackendUser;
}

interface BackendSharedComment {
  id: number;
  post_id: number;
  post_public_id: string | null;
  post_author_username: string | null;
  content: string;
  created_at: string;
  author: BackendUser;
}

interface BackendMessageReply {
  id: number;
  content: string;
  sender: BackendUser;
}

interface BackendMessage {
  id: number;
  content: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  media: { url: string; type: 'image' | 'video' }[] | null;
  read: boolean;
  created_at: string;
  sender: BackendUser;
  shared_post: BackendSharedPost | null;
  shared_comment: BackendSharedComment | null;
  shared_ad_id: number | null;
  reply_to: BackendMessageReply | null;
}

interface BackendMessageResult {
  id: number;
  content: string;
  created_at: string;
  from_me: boolean;
  conversation_user: BackendUser;
}

interface BackendGroup {
  id: number;
  // Identificador de URL (estilo Twitter, opaco) — ver backend models/group.py::public_id.
  public_id: string;
  name: string;
  description: string;
  avatar_url: string | null;
  privacy: 'public' | 'request' | 'closed';
  owner_id: number;
  neighborhood: string;
  members_count: number;
  created_at: string;
  my_role: string | null;
  my_request_pending: boolean | null;
  is_muted: boolean;
  muted_until: string | null;
}

interface BackendGroupMember {
  user: BackendUser;
  role: string;
  joined_at: string;
}

interface BackendGroupJoinRequest {
  user: BackendUser;
  created_at: string;
}

interface BackendGroupDetail extends BackendGroup {
  members: BackendGroupMember[];
  join_requests: BackendGroupJoinRequest[];
}

interface BackendGroupConversation {
  group: BackendGroup;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface BackendGroupMessage {
  id: number;
  content: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  media: { url: string; type: 'image' | 'video' }[] | null;
  created_at: string;
  sender: BackendUser;
  reply_to: BackendMessageReply | null;
}

interface BackendMediaGalleryItem {
  id: number;
  url: string;
  type: 'image' | 'video';
  created_at: string;
}

export interface GalleryMediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  createdAt: string;
}

function mapGalleryMediaItem(m: BackendMediaGalleryItem): GalleryMediaItem {
  return { id: String(m.id), url: m.url, type: m.type, createdAt: m.created_at };
}

interface BackendRemovedSnapshot {
  content: string;
  created_at: string;
  image_url?: string | null;
  category?: string | null;
  title?: string | null;
  location?: string | null;
}

interface BackendNotification {
  id: number;
  type: string;
  content: string;
  target_text: string | null;
  read: boolean;
  post_id: number | null;
  post_public_id: string | null;
  post_author_username: string | null;
  snapshot: BackendRemovedSnapshot | null;
  created_at: string;
  actor: BackendUser | null;
  // Só presentes na notificação mesclada de curtidas (mais de 3 curtidores).
  extra_actor?: BackendUser | null;
  group_count?: number | null;
}

interface BackendSupportTicket {
  id: number;
  subject: string;
  message: string;
  attachments: BackendPostMedia[];
  status: SupportTicketStatus;
  response: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface Conversation {
  user: User;
  lastMessage: string;
  time: string;
  unread: number;
  isMuted: boolean;
  mutedUntil?: string;
}

// Silenciamento de notificações (conversa ou grupo) — ver MuteMenu.
export type MuteDuration = '8h' | '1d' | '1w' | 'forever';

export interface MuteStatus {
  isMuted: boolean;
  mutedUntil?: string; // ausente = silenciado até reativar manualmente
}

interface BackendMuteStatus {
  is_muted: boolean;
  muted_until: string | null;
}

function mapMuteStatus(m: BackendMuteStatus): MuteStatus {
  return { isMuted: m.is_muted, mutedUntil: m.muted_until ?? undefined };
}

// Prévia de um post encaminhado dentro de uma mensagem (estilo Twitter).
export interface SharedPost {
  id: string;
  publicId: string;
  category: PostCategory;
  title?: string;
  content: string;
  image?: string;
  createdAt: string;
  author: User;
}

// Prévia de um comentário encaminhado dentro de uma mensagem.
export interface SharedComment {
  id: string;
  postId: string;
  // Post pai, pra montar o link `/{username}/post/{publicId}` sem
  // expor `postId` (ver backend models/comment.py). Ausentes no raro caso
  // de post pai já apagado.
  postPublicId?: string;
  postAuthorUsername?: string;
  content: string;
  createdAt: string;
  author: User;
}

export interface MessageReply {
  id: string;
  content: string;
  sender: User;
}

export interface ChatMessage {
  id: string;
  content: string;
  mediaUrl?: string; // foto ou vídeo anexado (opcional; mensagem pode ser só mídia)
  mediaType?: 'image' | 'video';
  media: PostMedia[];
  read: boolean;
  createdAt: string;
  sender: User;
  sharedPost?: SharedPost;
  sharedComment?: SharedComment;
  // Id de campanha no ads-backend (serviço separado) — a prévia é resolvida
  // no client via adsApi.getAdById, não vem embutida na mensagem.
  sharedAdId?: number;
  replyTo?: MessageReply;
}

export interface MessageResult {
  id: string;
  content: string;
  createdAt: string;
  fromMe: boolean;
  user: User; // o outro participante da conversa
}

export interface UsernameAvailability {
  username: string;
  valid: boolean;
  available: boolean;
}

// Resultado de login: token direto, pedido de 2º fator (A2F), ou e-mail ainda
// não confirmado — nos dois últimos casos vem um ticket pra completar em
// /auth/login/2fa ou /auth/verify-email respectivamente.
export type LoginResult =
  | { status: 'ok'; token: string }
  | { status: '2fa'; ticket: string }
  | { status: 'verify'; ticket: string };

// Resultado de "Entrar com Google": conta já existia (ou foi vinculada por
// e-mail já verificado pelo Google) → token direto; conta nova → falta
// escolher um nome de usuário, ver `signup_ticket` que completa em
// /auth/google/complete-signup.
export type GoogleAuthResult =
  | { status: 'ok'; token: string }
  | { status: 'needs_username'; ticket: string };

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
}

export interface NeighborhoodStats {
  neighborhood: string;
  neighbors: number;
  posts: number;
}

export interface NeighborhoodResolution {
  neighborhood: string;
  city: string;
  state: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

export interface Availability {
  available: boolean;
  error: string | null;
}

interface BackendCommunityStats {
  total_users: number;
  avatar_urls: string[];
}

export interface CommunityStats {
  totalUsers: number;
  avatarUrls: string[];
}

function mapCommunityStats(b: BackendCommunityStats): CommunityStats {
  return { totalUsers: b.total_users, avatarUrls: b.avatar_urls };
}

export interface NearbyNeighborhood {
  neighborhood: string;
  latitude: number;
  longitude: number;
  distanceM: number;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
}

export type GroupRole = 'owner' | 'admin' | 'member';

// public: qualquer um entra na hora. request: aparece no Descobrir mas
// entrar exige aprovação de um admin/dono. closed: só entra quem for
// adicionado direto por um admin.
export type GroupPrivacy = 'public' | 'request' | 'closed';

export interface Group {
  id: string;
  // Identificador de URL (estilo Twitter, opaco) — usado em /groups/{publicId}
  // no lugar de `id` pra não expor a posição sequencial do grupo.
  publicId: string;
  name: string;
  description: string;
  avatar?: string;
  privacy: GroupPrivacy;
  ownerId: string;
  neighborhood: string;
  membersCount: number;
  createdAt: string;
  myRole: GroupRole | null; // papel do usuário logado (null se não for membro)
  myRequestPending: boolean; // já pedi entrada e ainda não fui aprovado/recusado
  isMuted: boolean;
  mutedUntil?: string;
}

export interface GroupMember {
  user: User;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupJoinRequest {
  user: User;
  createdAt: string;
}

export interface GroupDetail extends Group {
  members: GroupMember[];
  joinRequests: GroupJoinRequest[];
}

export interface GroupConversation {
  group: Group;
  lastMessage: string;
  time: string;
  unread: number;
}

export interface AppReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export type SupportTicketStatus = 'pending' | 'answered';

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  attachments: PostMedia[];
  status: SupportTicketStatus;
  response?: string;
  respondedAt?: string;
  createdAt: string;
}

export type ReportTargetType = 'post' | 'comment' | 'user';

// Cópia do post/comentário removido pela moderação (ele já não existe mais).
export interface RemovedContentSnapshot {
  content: string;
  createdAt: string;
  imageUrl?: string;
  category?: string;
  title?: string;
  location?: string;
}

export interface AppNotification {
  id: string;
  type: string;
  content: string;
  targetText?: string;
  time: string;
  read: boolean;
  postId?: string;
  // Post alvo, pra montar o link `/{username}/post/{publicId}` sem
  // expor `postId` — ausentes quando não há post (ou já foi apagado).
  postPublicId?: string;
  postAuthorUsername?: string;
  actor?: User;
  snapshot?: RemovedContentSnapshot;
  // Só presentes na notificação mesclada de curtidas (mais de 3 curtidores):
  // extraActor é o segundo curtidor mais recente, groupCount é o total.
  extraActor?: User;
  groupCount?: number;
}

// ─────────────────────────────────────────────────────────────
// Adaptadores backend → modelos do app (camelCase)
// ─────────────────────────────────────────────────────────────
const FALLBACK_AVATAR = 'https://i.pravatar.cc/150?img=12';

export function mapUser(u: BackendUser): User {
  return {
    id: String(u.id),
    username: u.username,
    name: u.name,
    bio: u.bio ?? undefined,
    avatar: u.avatar_url || FALLBACK_AVATAR,
    cover: u.cover_url ?? undefined,
    neighborhood: u.neighborhood,
    city: u.city ?? undefined,
    state: u.state ?? undefined,
    badge: (u.badge as User['badge']) ?? undefined,
    verified: u.verified,
    joinedAt: new Date(u.created_at).toLocaleDateString(activeLocale(), {
      month: 'short',
      year: 'numeric',
    }),
    postsCount: u.posts_count,
    interactionsCount: u.interactions_count,
    latitude: u.latitude ?? undefined,
    longitude: u.longitude ?? undefined,
    locked: u.locked ?? false,
    twoFactorEnabled: u.two_factor_enabled,
    pendingNotice: u.pending_notice ?? undefined,
    email: u.email ?? undefined,
    showLocation: u.show_location,
    searchable: u.searchable,
    hideResidentBadge: u.hide_resident_badge,
    notifyLikes: u.notify_likes,
    notifyComments: u.notify_comments,
    notifyMessages: u.notify_messages,
    notifyNeighborhoodAlerts: u.notify_neighborhood_alerts,
    includeNearby: u.include_nearby,
  };
}

export interface ImportantQuota {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string; // ISO — início do próximo mês
}

function mapImportantQuota(q: BackendImportantQuota): ImportantQuota {
  return { used: q.used, limit: q.limit, remaining: q.remaining, resetsAt: q.resets_at };
}

function mapPoll(p: BackendPoll): Poll {
  return {
    multiple: p.multiple,
    closesAt: p.closes_at,
    closed: p.closed,
    totalVotes: p.total_votes,
    options: p.options.map((o) => ({
      id: String(o.id),
      text: o.text,
      votesCount: o.votes_count,
    })),
    myVotes: p.my_votes.map(String),
  };
}

function mapPost(p: BackendPost): Post {
  const d = p.details ?? {};
  return {
    id: String(p.id),
    publicId: p.public_id,
    author: mapUser(p.author),
    authorIsResident: p.author_is_resident,
    category: p.category as PostCategory,
    title: p.title ?? undefined,
    content: p.content,
    media: p.media.length ? p.media : undefined,
    createdAt: p.created_at, // ISO — formatado na renderização (lib/time)
    likesCount: p.likes_count,
    commentsCount: p.comments_count,
    sharesCount: p.shares_count,
    neighborhood: p.neighborhood,
    distance: '',
    latitude: p.latitude ?? undefined,
    longitude: p.longitude ?? undefined,
    liked: p.liked,
    reposted: p.reposted,
    quotedPost: p.quoted_post ? mapSharedPost(p.quoted_post) : undefined,
    quotedComment: p.quoted_comment ? mapSharedComment(p.quoted_comment) : undefined,
    quotedAdId: p.quoted_ad_id ?? undefined,
    repostedBy: p.reposted_by ? mapUser(p.reposted_by) : undefined,
    repostedAt: p.reposted_at ?? undefined,
    pinned: p.pinned,
    important: p.important,
    // Campos específicos por categoria (backend snake_case → camelCase)
    eventDates: Array.isArray(d.event_dates) ? d.event_dates : undefined,
    allDay: d.all_day ?? undefined,
    eventTime: d.event_time ?? undefined,
    placeName: d.place_name ?? undefined,
    location: p.location ?? d.location ?? undefined,
    price: typeof d.price === 'number' ? d.price : undefined,
    priceNegotiable: d.price_negotiable ?? undefined,
    poll: p.poll ? mapPoll(p.poll) : undefined,
  };
}

function mapComment(c: BackendComment): Comment {
  return {
    id: String(c.id),
    postId: String(c.post_id),
    postPublicId: c.post_public_id ?? undefined,
    postAuthorUsername: c.post_author_username ?? undefined,
    parentId: c.parent_id != null ? String(c.parent_id) : undefined,
    content: c.content,
    imageUrl: c.image_url ?? undefined,
    createdAt: c.created_at, // ISO — formatado na renderização (lib/time)
    author: mapUser(c.author),
    authorIsResident: c.author_is_resident,
    likesCount: c.likes_count,
    liked: c.liked,
    repostsCount: c.reposts_count,
    reposted: c.reposted,
    repliesCount: c.replies_count,
  };
}

function mapSession(s: BackendSession): UserSession {
  return {
    id: String(s.id),
    deviceName: s.device_name,
    createdAt: s.created_at,
    isCurrent: s.is_current,
  };
}

function mapConversation(c: BackendConversation): Conversation {
  return {
    user: mapUser(c.user),
    lastMessage: c.last_message,
    time: c.last_message_at, // ISO — formatado na renderização (lib/time)
    unread: c.unread_count,
    isMuted: c.is_muted,
    mutedUntil: c.muted_until ?? undefined,
  };
}

function mapSharedPost(p: BackendSharedPost): SharedPost {
  return {
    id: String(p.id),
    publicId: p.public_id,
    category: p.category as PostCategory,
    title: p.title ?? undefined,
    content: p.content,
    image: p.image_urls[0] ?? undefined,
    createdAt: p.created_at,
    author: mapUser(p.author),
  };
}

function mapSharedComment(c: BackendSharedComment): SharedComment {
  return {
    id: String(c.id),
    postId: String(c.post_id),
    postPublicId: c.post_public_id ?? undefined,
    postAuthorUsername: c.post_author_username ?? undefined,
    content: c.content,
    createdAt: c.created_at,
    author: mapUser(c.author),
  };
}

function mapMessageReply(r: BackendMessageReply): MessageReply {
  return { id: String(r.id), content: r.content, sender: mapUser(r.sender) };
}

function mapMessage(m: BackendMessage): ChatMessage {
  return {
    id: String(m.id),
    content: m.content,
    mediaUrl: m.media_url ?? undefined,
    mediaType: m.media_type ?? undefined,
    media: m.media?.length
      ? m.media
      : m.media_url ? [{ url: m.media_url, type: m.media_type ?? 'image' }] : [],
    read: m.read,
    createdAt: m.created_at,
    sender: mapUser(m.sender),
    sharedPost: m.shared_post ? mapSharedPost(m.shared_post) : undefined,
    sharedComment: m.shared_comment ? mapSharedComment(m.shared_comment) : undefined,
    sharedAdId: m.shared_ad_id ?? undefined,
    replyTo: m.reply_to ? mapMessageReply(m.reply_to) : undefined,
  };
}

function mapMessageResult(m: BackendMessageResult): MessageResult {
  return {
    id: String(m.id),
    content: m.content,
    createdAt: m.created_at,
    fromMe: m.from_me,
    user: mapUser(m.conversation_user),
  };
}

function mapGroup(g: BackendGroup): Group {
  return {
    id: String(g.id),
    publicId: g.public_id,
    name: g.name,
    description: g.description,
    avatar: g.avatar_url ?? undefined,
    privacy: g.privacy,
    ownerId: String(g.owner_id),
    neighborhood: g.neighborhood,
    membersCount: g.members_count,
    createdAt: g.created_at,
    myRole: (g.my_role as GroupRole | null) ?? null,
    myRequestPending: g.my_request_pending ?? false,
    isMuted: g.is_muted,
    mutedUntil: g.muted_until ?? undefined,
  };
}

function mapGroupMember(m: BackendGroupMember): GroupMember {
  return { user: mapUser(m.user), role: m.role as GroupRole, joinedAt: m.joined_at };
}

function mapGroupJoinRequest(r: BackendGroupJoinRequest): GroupJoinRequest {
  return { user: mapUser(r.user), createdAt: r.created_at };
}

function mapGroupDetail(g: BackendGroupDetail): GroupDetail {
  return {
    ...mapGroup(g),
    members: (g.members ?? []).map(mapGroupMember),
    joinRequests: (g.join_requests ?? []).map(mapGroupJoinRequest),
  };
}

function mapGroupConversation(c: BackendGroupConversation): GroupConversation {
  return {
    group: mapGroup(c.group),
    lastMessage: c.last_message,
    time: c.last_message_at, // ISO — formatado na renderização (lib/time)
    unread: c.unread_count,
  };
}

function mapGroupMessage(m: BackendGroupMessage): ChatMessage {
  return {
    id: String(m.id),
    content: m.content,
    mediaUrl: m.media_url ?? undefined,
    mediaType: m.media_type ?? undefined,
    media: m.media?.length
      ? m.media
      : m.media_url ? [{ url: m.media_url, type: m.media_type ?? 'image' }] : [],
    read: true,
    createdAt: m.created_at,
    sender: mapUser(m.sender),
    replyTo: m.reply_to ? mapMessageReply(m.reply_to) : undefined,
  };
}

function mapNotification(n: BackendNotification): AppNotification {
  return {
    id: String(n.id),
    type: n.type,
    content: n.content,
    targetText: n.target_text ?? undefined,
    time: n.created_at, // ISO — formatado na renderização (lib/time)
    read: n.read,
    postId: n.post_id != null ? String(n.post_id) : undefined,
    postPublicId: n.post_public_id ?? undefined,
    postAuthorUsername: n.post_author_username ?? undefined,
    actor: n.actor ? mapUser(n.actor) : undefined,
    extraActor: n.extra_actor ? mapUser(n.extra_actor) : undefined,
    groupCount: n.group_count ?? undefined,
    snapshot: n.snapshot
      ? {
          content: n.snapshot.content,
          createdAt: n.snapshot.created_at,
          imageUrl: n.snapshot.image_url ?? undefined,
          category: n.snapshot.category ?? undefined,
          title: n.snapshot.title ?? undefined,
          location: n.snapshot.location ?? undefined,
        }
      : undefined,
  };
}

function mapSupportTicket(t: BackendSupportTicket): SupportTicket {
  return {
    id: String(t.id),
    subject: t.subject,
    message: t.message,
    attachments: t.attachments,
    status: t.status,
    response: t.response ?? undefined,
    respondedAt: t.responded_at ?? undefined,
    createdAt: t.created_at,
  };
}

// ─────────────────────────────────────────────────────────────
// Endpoints
// ─────────────────────────────────────────────────────────────
export const api = {
  // Cadastro não loga direto: devolve um ticket p/ confirmar o código de 6
  // dígitos enviado por e-mail em /auth/verify-email (ver `verifyEmailCode`).
  async signup(payload: {
    name: string;
    username: string;
    email: string;
    password: string;
  }): Promise<string> {
    const r = await request<{ ticket: string }>('/auth/signup', {
      method: 'POST',
      body: payload,
      auth: false,
    });
    return r.ticket;
  },

  async verifyEmailCode(ticket: string, code: string): Promise<string> {
    const r = await request<{ access_token: string }>('/auth/verify-email', {
      method: 'POST',
      body: { ticket, code },
      auth: false,
    });
    return r.access_token;
  },

  // Reenvia o código de 6 dígitos (novo ticket, novo prazo de 10min).
  async resendVerification(ticket: string): Promise<string> {
    const r = await request<{ ticket: string }>('/auth/resend-verification', {
      method: 'POST',
      body: { ticket },
      auth: false,
    });
    return r.ticket;
  },

  // "Entrar com Google": envia o id_token do Google (ver GoogleSignInButton).
  // Conta nova devolve needs_username + um ticket que completa o cadastro em
  // completeGoogleSignup (ver `useAuth().completeGoogleSignup`).
  async googleAuth(idToken: string): Promise<GoogleAuthResult> {
    const r = await request<{
      needs_username: boolean;
      signup_ticket: string | null;
      access_token: string | null;
    }>('/auth/google', {
      method: 'POST',
      body: { id_token: idToken },
      auth: false,
    });
    if (r.needs_username) return { status: 'needs_username', ticket: r.signup_ticket! };
    return { status: 'ok', token: r.access_token! };
  },

  // Último passo do cadastro via Google: escolher um nome de usuário.
  async completeGoogleSignup(ticket: string, username: string): Promise<string> {
    const r = await request<{ access_token: string }>('/auth/google/complete-signup', {
      method: 'POST',
      body: { signup_ticket: ticket, username },
      auth: false,
    });
    return r.access_token;
  },

  async forgotPassword(email: string): Promise<void> {
    await request<void>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
      auth: false,
    });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await request<void>('/auth/reset-password', {
      method: 'POST',
      body: { token, new_password: newPassword },
      auth: false,
    });
  },

  // Checagens públicas de disponibilidade no cadastro (formato + já em uso).
  async checkSignupUsername(username: string): Promise<Availability> {
    return request<Availability>(
      `/auth/check-username?username=${encodeURIComponent(username)}`,
      { auth: false },
    );
  },

  async checkSignupEmail(email: string): Promise<Availability> {
    return request<Availability>(
      `/auth/check-email?email=${encodeURIComponent(email)}`,
      { auth: false },
    );
  },

  // Vitrine da tela de boas-vindas (pré-login) — total de contas + fotos
  // reais mais recentes (ver welcome.tsx).
  async getCommunityStats(): Promise<CommunityStats> {
    return mapCommunityStats(
      await request<BackendCommunityStats>('/auth/community-stats', { auth: false }),
    );
  },

  async login(email: string, password: string): Promise<LoginResult> {
    const r = await request<{
      requires_verification: boolean;
      requires_2fa: boolean;
      ticket: string | null;
      access_token: string | null;
    }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    if (r.requires_verification && r.ticket) return { status: 'verify', ticket: r.ticket };
    if (r.requires_2fa && r.ticket) return { status: '2fa', ticket: r.ticket };
    return { status: 'ok', token: r.access_token! };
  },

  async loginVerify2fa(ticket: string, code: string): Promise<string> {
    const r = await request<{ access_token: string }>('/auth/login/2fa', {
      method: 'POST',
      body: { ticket, code },
      auth: false,
    });
    return r.access_token;
  },

  async start2faSetup(): Promise<TwoFactorSetup> {
    const r = await request<{ secret: string; otpauth_url: string }>('/auth/2fa/setup', {
      method: 'POST',
    });
    return { secret: r.secret, otpauthUrl: r.otpauth_url };
  },

  async enable2fa(code: string): Promise<User> {
    return mapUser(
      await request<BackendUser>('/auth/2fa/enable', { method: 'POST', body: { code } }),
    );
  },

  async disable2fa(code: string): Promise<User> {
    return mapUser(
      await request<BackendUser>('/auth/2fa/disable', { method: 'POST', body: { code } }),
    );
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await request<void>('/auth/change-password', {
      method: 'POST',
      body: { current_password: currentPassword, new_password: newPassword },
    });
  },

  async logout(): Promise<void> {
    await request<void>('/auth/logout', { method: 'POST' });
  },

  async getSessions(): Promise<UserSession[]> {
    const r = await request<BackendSession[]>('/auth/sessions');
    return r.map(mapSession);
  },

  async revokeSession(id: string): Promise<void> {
    await request<void>(`/auth/sessions/${id}`, { method: 'DELETE' });
  },

  async me(): Promise<User> {
    return mapUser(await request<BackendUser>('/auth/me'));
  },

  async updateProfile(payload: {
    username?: string;
    name?: string;
    bio?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    latitude?: number;
    longitude?: number;
    show_location?: boolean;
    searchable?: boolean;
    hide_resident_badge?: boolean;
    notify_likes?: boolean;
    notify_comments?: boolean;
    notify_messages?: boolean;
    notify_neighborhood_alerts?: boolean;
    include_nearby?: boolean;
  }): Promise<User> {
    return mapUser(
      await request<BackendUser>('/users/me', { method: 'PATCH', body: payload }),
    );
  },

  async checkUsername(username: string): Promise<UsernameAvailability> {
    return request<UsernameAvailability>(
      `/users/check-username?username=${encodeURIComponent(username)}`,
    );
  },

  async updateAvatar(imageDataUrl: string): Promise<User> {
    return mapUser(
      await request<BackendUser>('/users/me/avatar', {
        method: 'POST',
        body: { image: imageDataUrl },
      }),
    );
  },

  async updateCover(imageDataUrl: string): Promise<User> {
    return mapUser(
      await request<BackendUser>('/users/me/cover', {
        method: 'POST',
        body: { image: imageDataUrl },
      }),
    );
  },

  async getNeighborhoodStats(): Promise<NeighborhoodStats> {
    return request<NeighborhoodStats>('/users/neighborhood-stats');
  },

  async getFeed(opts: {
    category?: string;
    neighborhood?: string; // bairro em foco (ex.: "perto de mim"); ausente = bairro cadastrado
    latitude?: number;
    longitude?: number;
    includeNearby?: boolean; // incluir também os bairros vizinhos
    page?: number; // paginação (rolagem infinita) — default do backend: página 1
    pageSize?: number; // default do backend: 20
  } = {}): Promise<{ items: Post[]; total: number; page: number; pageSize: number }> {
    const params = new URLSearchParams();
    if (opts.category && opts.category !== 'todos') params.set('category', opts.category);
    if (opts.neighborhood) params.set('neighborhood', opts.neighborhood);
    if (opts.latitude != null) params.set('latitude', String(opts.latitude));
    if (opts.longitude != null) params.set('longitude', String(opts.longitude));
    if (opts.includeNearby) params.set('include_nearby', 'true');
    if (opts.page != null) params.set('page', String(opts.page));
    if (opts.pageSize != null) params.set('page_size', String(opts.pageSize));
    const q = params.toString() ? `?${params.toString()}` : '';
    const r = await request<{ items: BackendPost[]; total: number; page: number; page_size: number }>(
      `/posts/feed${q}`,
    );
    return { items: r.items.map(mapPost), total: r.total, page: r.page, pageSize: r.page_size };
  },

  async getPost(id: string): Promise<Post> {
    return mapPost(await request<BackendPost>(`/posts/${id}`));
  },

  // Resolve a URL pública `/{username}/post/{publicId}` — o
  // `username` no path é decorativo, a busca é só pelo `publicId`.
  async getPostByPublicId(publicId: string): Promise<Post> {
    return mapPost(await request<BackendPost>(`/posts/by-public-id/${encodeURIComponent(publicId)}`));
  },

  async search(
    query: string,
    type: SearchType = 'all',
  ): Promise<{ posts: Post[]; users: User[] }> {
    const q = `?q=${encodeURIComponent(query)}&type=${type}`;
    const r = await request<{ posts: BackendPost[]; users: BackendUser[] }>(`/search${q}`);
    return { posts: r.posts.map(mapPost), users: r.users.map(mapUser) };
  },

  async getTopImportant(): Promise<Post | null> {
    const p = await request<BackendPost | null>('/posts/important');
    return p ? mapPost(p) : null;
  },

  // Bounding box do recorte visível do mapa (ver components/leafletHtml.ts,
  // que reporta os limites reais renderizados) — sem filtro de bairro, o
  // mapa mostra qualquer post com coordenadas dentro da área visível.
  async getMapPosts(bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<Post[]> {
    const qs = new URLSearchParams({
      min_lat: String(bounds.minLat),
      max_lat: String(bounds.maxLat),
      min_lng: String(bounds.minLng),
      max_lng: String(bounds.maxLng),
    });
    const r = await request<BackendPost[]>(`/posts/map?${qs.toString()}`);
    return r.map(mapPost);
  },

  // Público: descobre o bairro a partir das coordenadas do dispositivo (no cadastro).
  async resolveNeighborhood(
    latitude: number,
    longitude: number,
  ): Promise<NeighborhoodResolution> {
    const r = await request<{
      neighborhood: string;
      city: string;
      state: string;
      display_name: string;
      latitude: number;
      longitude: number;
    }>('/geo/resolve', {
      method: 'POST',
      body: { latitude, longitude },
      auth: false,
    });
    return {
      neighborhood: r.neighborhood,
      city: r.city,
      state: r.state,
      displayName: r.display_name,
      latitude: r.latitude,
      longitude: r.longitude,
    };
  },

  // Público: bairros vizinhos ao ponto, para escolher quando o detectado não for o certo.
  async nearbyNeighborhoods(
    latitude: number,
    longitude: number,
  ): Promise<NearbyNeighborhood[]> {
    const r = await request<
      { neighborhood: string; latitude: number; longitude: number; distance_m: number }[]
    >('/geo/nearby', {
      method: 'POST',
      body: { latitude, longitude },
      auth: false,
    });
    return r.map((n) => ({
      neighborhood: n.neighborhood,
      latitude: n.latitude,
      longitude: n.longitude,
      distanceM: n.distance_m,
    }));
  },

  // Valida um endereço contra o bairro do usuário logado (ao publicar).
  async geocode(address: string): Promise<GeocodeResult> {
    return request<GeocodeResult>('/geo/geocode', {
      method: 'POST',
      body: { address },
    });
  },

  // Sugestões de endereço (autocomplete, tipo iFood/Uber) enquanto o usuário
  // digita — já filtradas pro bairro dele, então escolher uma marca o local
  // como válido sem precisar validar de novo.
  async searchAddress(query: string): Promise<GeocodeResult[]> {
    return request<GeocodeResult[]>('/geo/search', {
      method: 'POST',
      body: { query },
    });
  },

  async toggleLike(id: string): Promise<Post> {
    return mapPost(await request<BackendPost>(`/posts/${id}/like`, { method: 'POST' }));
  },

  // Quem curtiu o post, curtida mais recente primeiro — dono do post vê no modal "Curtidas".
  async getPostLikers(id: string): Promise<User[]> {
    return (await request<BackendUser[]>(`/posts/${id}/likes`)).map(mapUser);
  },

  async toggleRepost(id: string): Promise<Post> {
    return mapPost(await request<BackendPost>(`/posts/${id}/repost`, { method: 'POST' }));
  },

  async uploadPostMedia(asset: PickedMediaAsset): Promise<PostMedia> {
    const formData = await buildMediaFormData(asset);
    return requestMultipart<PostMedia>('/posts/media', formData);
  },

  async uploadReportAttachment(asset: PickedMediaAsset): Promise<PostMedia> {
    const formData = await buildMediaFormData(asset);
    return requestMultipart<PostMedia>('/reports/attachments', formData);
  },

  async uploadTicketAttachment(asset: PickedMediaAsset): Promise<PostMedia> {
    const formData = await buildMediaFormData(asset);
    return requestMultipart<PostMedia>('/support-tickets/attachments', formData);
  },

  async uploadCommentAttachment(asset: PickedMediaAsset): Promise<PostMedia> {
    const formData = await buildMediaFormData(asset);
    return requestMultipart<PostMedia>('/comments/media', formData);
  },

  async uploadMessageAttachment(asset: PickedMediaAsset): Promise<PostMedia> {
    const formData = await buildMediaFormData(asset);
    return requestMultipart<PostMedia>('/messages/media', formData);
  },

  async uploadGroupMessageAttachment(groupId: string, asset: PickedMediaAsset): Promise<PostMedia> {
    const formData = await buildMediaFormData(asset);
    return requestMultipart<PostMedia>(`/groups/${groupId}/media`, formData);
  },

  // Galeria de mídia já compartilhada na conversa (DM) ou no grupo — usada
  // pela tela "Mídia, links e arquivos" (ver components/MediaGalleryView.tsx).
  async getDmMedia(userId: string): Promise<GalleryMediaItem[]> {
    const r = await request<BackendMediaGalleryItem[]>(`/messages/${userId}/media`);
    return r.map(mapGalleryMediaItem);
  },

  async getGroupMedia(groupId: string): Promise<GalleryMediaItem[]> {
    const r = await request<BackendMediaGalleryItem[]>(`/groups/${groupId}/media`);
    return r.map(mapGalleryMediaItem);
  },

  async getImportantQuota(): Promise<ImportantQuota> {
    return mapImportantQuota(await request<BackendImportantQuota>('/posts/important-quota'));
  },

  async createPost(payload: {
    category: string;
    title?: string;
    content: string;
    media?: PostMedia[]; // já enviados via uploadPostMedia, até 10 itens
    details?: Record<string, any>;
    important?: boolean;
    // Coordenadas já resolvidas no cliente (autocomplete ou pin no mapa) —
    // dispensa o backend de regeocodificar `details.location` do zero.
    latitude?: number;
    longitude?: number;
    poll?: { options: string[]; multiple: boolean; closes_at: string };
    // Repost com citação (estilo Twitter): no máximo um dos três.
    quotedPostId?: string;
    quotedCommentId?: string;
    quotedAdId?: number;
  }): Promise<Post> {
    const { quotedPostId, quotedCommentId, quotedAdId, ...rest } = payload;
    return mapPost(
      await request<BackendPost>('/posts/', {
        method: 'POST',
        body: {
          ...rest,
          quoted_post_id: quotedPostId ? Number(quotedPostId) : undefined,
          quoted_comment_id: quotedCommentId ? Number(quotedCommentId) : undefined,
          quoted_ad_id: quotedAdId,
        },
      }),
    );
  },

  // Edita post (usado para enquetes: opções, múltiplo e prazo — sempre para o futuro).
  async updatePost(
    id: string,
    payload: {
      title?: string;
      content?: string;
      poll?: {
        options: { id?: string; text: string }[];
        multiple: boolean;
        closes_at: string;
      };
    },
  ): Promise<Post> {
    const body: any = { title: payload.title, content: payload.content };
    if (payload.poll) {
      body.poll = {
        multiple: payload.poll.multiple,
        closes_at: payload.poll.closes_at,
        options: payload.poll.options.map((o) => ({
          id: o.id != null ? Number(o.id) : undefined,
          text: o.text,
        })),
      };
    }
    return mapPost(await request<BackendPost>(`/posts/${id}`, { method: 'PATCH', body }));
  },

  async votePoll(id: string, optionIds: string[]): Promise<Post> {
    return mapPost(
      await request<BackendPost>(`/posts/${id}/vote`, {
        method: 'POST',
        body: { option_ids: optionIds.map(Number) },
      }),
    );
  },

  // Remove o voto do usuário (desvotar).
  async unvotePoll(id: string): Promise<Post> {
    return mapPost(await request<BackendPost>(`/posts/${id}/vote`, { method: 'DELETE' }));
  },

  async deletePost(id: string): Promise<void> {
    await request<void>(`/posts/${id}`, { method: 'DELETE' });
  },

  async getNeighbors(): Promise<User[]> {
    const r = await request<BackendUser[]>('/users/neighbors');
    return r.map(mapUser);
  },

  async getPopular(): Promise<User[]> {
    const r = await request<BackendUser[]>('/users/popular');
    return r.map(mapUser);
  },

  async getUser(id: string): Promise<User> {
    return mapUser(await request<BackendUser>(`/users/${id}`));
  },

  // Resolve um @handle → usuário (usado ao tocar numa menção no texto).
  async getUserByUsername(username: string): Promise<User> {
    return mapUser(await request<BackendUser>(`/users/by-username/${encodeURIComponent(username)}`));
  },

  async getUserPosts(id: string): Promise<Post[]> {
    const r = await request<BackendPost[]>(`/users/${id}/posts`);
    return r.map(mapPost);
  },

  async listComments(postId: string): Promise<Comment[]> {
    const r = await request<BackendComment[]>(`/posts/${postId}/comments`);
    return r.map(mapComment);
  },

  async addComment(
    postId: string,
    content: string,
    parentId?: string,
    imageUrl?: string,
  ): Promise<Comment> {
    return mapComment(
      await request<BackendComment>(`/posts/${postId}/comments`, {
        method: 'POST',
        body: {
          content,
          parent_id: parentId ? Number(parentId) : undefined,
          image_url: imageUrl,
        },
      }),
    );
  },

  async getComment(commentId: string): Promise<Comment> {
    return mapComment(await request<BackendComment>(`/comments/${commentId}`));
  },

  // Respostas diretas de um comentário (recentes primeiro). Carregado sob demanda.
  async getReplies(commentId: string): Promise<Comment[]> {
    const r = await request<BackendComment[]>(`/comments/${commentId}/replies`);
    return r.map(mapComment);
  },

  async toggleCommentLike(commentId: string): Promise<Comment> {
    return mapComment(
      await request<BackendComment>(`/comments/${commentId}/like`, { method: 'POST' }),
    );
  },

  async toggleCommentRepost(commentId: string): Promise<Comment> {
    return mapComment(
      await request<BackendComment>(`/comments/${commentId}/repost`, { method: 'POST' }),
    );
  },

  async deleteComment(commentId: string): Promise<void> {
    await request<void>(`/comments/${commentId}`, { method: 'DELETE' });
  },

  async getConversations(): Promise<Conversation[]> {
    const r = await request<BackendConversation[]>('/messages/conversations');
    return r.map(mapConversation);
  },

  async getUnreadMessagesCount(): Promise<number> {
    const r = await request<{ count: number }>('/messages/unread-count');
    return r.count;
  },

  async searchMessages(query: string): Promise<MessageResult[]> {
    const r = await request<BackendMessageResult[]>(
      `/messages/search?q=${encodeURIComponent(query)}`,
    );
    return r.map(mapMessageResult);
  },

  async getThread(userId: string): Promise<ChatMessage[]> {
    const r = await request<BackendMessage[]>(`/messages/${userId}`);
    return r.map(mapMessage);
  },

  async getDmMuteStatus(userId: string): Promise<MuteStatus> {
    return mapMuteStatus(await request<BackendMuteStatus>(`/messages/${userId}/mute`));
  },

  async muteDm(userId: string, duration: MuteDuration): Promise<MuteStatus> {
    return mapMuteStatus(
      await request<BackendMuteStatus>(`/messages/${userId}/mute`, {
        method: 'POST',
        body: { duration },
      }),
    );
  },

  async unmuteDm(userId: string): Promise<MuteStatus> {
    return mapMuteStatus(
      await request<BackendMuteStatus>(`/messages/${userId}/mute`, { method: 'DELETE' }),
    );
  },

  async registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
    await request<void>('/push/register', { method: 'POST', body: { token, platform } });
  },

  async unregisterPushToken(token: string): Promise<void> {
    await request<void>(`/push/register?token=${encodeURIComponent(token)}`, {
      method: 'DELETE',
    });
  },

  // Avisa o servidor que estou digitando (DM ou grupo) — lido pelo polling
  // do websocket e repassado a quem está na mesma conversa.
  async pingTyping(kind: 'dm' | 'group', id: string): Promise<void> {
    await request<void>('/messages/typing', {
      method: 'POST',
      body: { target_type: kind, target_id: Number(id) },
    });
  },

  async sendMessage(
    receiverId: string,
    content: string,
    sharedPostId?: string,
    replyToId?: string,
    sharedCommentId?: string,
    sharedAdId?: number,
    mediaUrl?: string,
    mediaType?: 'image' | 'video',
    media?: PostMedia[],
  ): Promise<ChatMessage> {
    return mapMessage(
      await request<BackendMessage>('/messages/', {
        method: 'POST',
        body: {
          receiver_id: Number(receiverId),
          content,
          shared_post_id: sharedPostId ? Number(sharedPostId) : undefined,
          shared_comment_id: sharedCommentId ? Number(sharedCommentId) : undefined,
          reply_to_id: replyToId ? Number(replyToId) : undefined,
          shared_ad_id: sharedAdId,
          media_url: mediaUrl,
          media_type: mediaType,
          media,
        },
      }),
    );
  },

  // ── Grupos ────────────────────────────────────────────────
  async createGroup(payload: {
    name: string;
    description?: string;
    privacy: GroupPrivacy;
    memberIds?: string[];
  }): Promise<GroupDetail> {
    return mapGroupDetail(
      await request<BackendGroupDetail>('/groups/', {
        method: 'POST',
        body: {
          name: payload.name,
          description: payload.description ?? '',
          privacy: payload.privacy,
          member_ids: (payload.memberIds ?? []).map(Number),
        },
      }),
    );
  },

  async getGroupConversations(): Promise<GroupConversation[]> {
    const r = await request<BackendGroupConversation[]>('/groups/conversations');
    return r.map(mapGroupConversation);
  },

  async discoverGroups(query: string): Promise<Group[]> {
    const r = await request<BackendGroup[]>(
      `/groups/discover?q=${encodeURIComponent(query)}`,
    );
    return r.map(mapGroup);
  },

  async getGroup(id: string): Promise<GroupDetail> {
    return mapGroupDetail(await request<BackendGroupDetail>(`/groups/${id}`));
  },

  // Resolve a URL pública `/groups/{publicId}` pelo identificador opaco.
  async getGroupByPublicId(publicId: string): Promise<GroupDetail> {
    return mapGroupDetail(
      await request<BackendGroupDetail>(`/groups/by-public-id/${encodeURIComponent(publicId)}`),
    );
  },

  async updateGroup(
    id: string,
    payload: { name?: string; description?: string; privacy?: GroupPrivacy },
  ): Promise<GroupDetail> {
    return mapGroupDetail(
      await request<BackendGroupDetail>(`/groups/${id}`, {
        method: 'PATCH',
        body: {
          name: payload.name,
          description: payload.description,
          privacy: payload.privacy,
        },
      }),
    );
  },

  async deleteGroup(id: string): Promise<void> {
    await request<void>(`/groups/${id}`, { method: 'DELETE' });
  },

  // Troca a foto do grupo (dono/admin). imageDataUrl: "data:image/...;base64,...".
  async updateGroupAvatar(id: string, imageDataUrl: string): Promise<GroupDetail> {
    return mapGroupDetail(
      await request<BackendGroupDetail>(`/groups/${id}/avatar`, {
        method: 'POST',
        body: { image: imageDataUrl },
      }),
    );
  },

  // Grupo público: entra na hora. Grupo "request": cria/reusa uma solicitação
  // pendente (GroupDetail volta com myRequestPending=true e myRole=null).
  async joinGroup(id: string): Promise<GroupDetail> {
    return mapGroupDetail(
      await request<BackendGroupDetail>(`/groups/${id}/join`, { method: 'POST' }),
    );
  },

  // Cancela uma solicitação de entrada pendente (grupo "request").
  async cancelJoinRequest(id: string): Promise<void> {
    await request<void>(`/groups/${id}/join`, { method: 'DELETE' });
  },

  async leaveGroup(id: string): Promise<void> {
    await request<void>(`/groups/${id}/leave`, { method: 'POST' });
  },

  async approveGroupJoinRequest(id: string, userId: string): Promise<GroupDetail> {
    return mapGroupDetail(
      await request<BackendGroupDetail>(`/groups/${id}/join-requests/${userId}/approve`, {
        method: 'POST',
      }),
    );
  },

  async rejectGroupJoinRequest(id: string, userId: string): Promise<GroupDetail> {
    return mapGroupDetail(
      await request<BackendGroupDetail>(`/groups/${id}/join-requests/${userId}/reject`, {
        method: 'POST',
      }),
    );
  },

  async addGroupMember(id: string, userId: string): Promise<GroupDetail> {
    return mapGroupDetail(
      await request<BackendGroupDetail>(`/groups/${id}/members`, {
        method: 'POST',
        body: { user_id: Number(userId) },
      }),
    );
  },

  async removeGroupMember(id: string, userId: string): Promise<GroupDetail> {
    return mapGroupDetail(
      await request<BackendGroupDetail>(`/groups/${id}/members/${userId}`, {
        method: 'DELETE',
      }),
    );
  },

  async setGroupAdmin(id: string, userId: string, makeAdmin: boolean): Promise<GroupDetail> {
    return mapGroupDetail(
      await request<BackendGroupDetail>(`/groups/${id}/members/${userId}/admin`, {
        method: makeAdmin ? 'POST' : 'DELETE',
      }),
    );
  },

  async getGroupThread(id: string): Promise<ChatMessage[]> {
    const r = await request<BackendGroupMessage[]>(`/groups/${id}/messages`);
    return r.map(mapGroupMessage);
  },

  async sendGroupMessage(
    id: string,
    content: string,
    replyToId?: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'video',
    media?: PostMedia[],
  ): Promise<ChatMessage> {
    return mapGroupMessage(
      await request<BackendGroupMessage>(`/groups/${id}/messages`, {
        method: 'POST',
        body: {
          content,
          reply_to_id: replyToId ? Number(replyToId) : undefined,
          media_url: mediaUrl,
          media_type: mediaType,
          media,
        },
      }),
    );
  },

  async muteGroup(id: string, duration: MuteDuration): Promise<MuteStatus> {
    return mapMuteStatus(
      await request<BackendMuteStatus>(`/groups/${id}/mute`, {
        method: 'POST',
        body: { duration },
      }),
    );
  },

  async unmuteGroup(id: string): Promise<MuteStatus> {
    return mapMuteStatus(
      await request<BackendMuteStatus>(`/groups/${id}/mute`, { method: 'DELETE' }),
    );
  },

  // ── Avaliação do app ──────────────────────────────────────
  async getMyReview(): Promise<AppReview | null> {
    const r = await request<{
      id: number;
      rating: number;
      comment: string;
      created_at: string;
      updated_at: string;
    } | null>('/reviews/me');
    if (!r) return null;
    return {
      id: String(r.id),
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },

  async submitReview(rating: number, comment: string): Promise<void> {
    await request<unknown>('/reviews/', { method: 'POST', body: { rating, comment } });
  },

  // ── Denúncias ──────────────────────────────────────────────
  async submitReport(
    targetType: ReportTargetType,
    targetId: string,
    reason: string,
    comment: string,
    attachments: PostMedia[] = [],
  ): Promise<void> {
    await request<unknown>('/reports/', {
      method: 'POST',
      body: {
        target_type: targetType,
        target_id: Number(targetId),
        reason,
        comment,
        attachments,
      },
    });
  },

  // ── Chamados de suporte ─────────────────────────────────────
  async getMySupportTickets(): Promise<SupportTicket[]> {
    const r = await request<BackendSupportTicket[]>('/support-tickets/mine');
    return r.map(mapSupportTicket);
  },

  async submitSupportTicket(
    subject: string,
    message: string,
    attachments: PostMedia[] = [],
  ): Promise<SupportTicket> {
    return mapSupportTicket(
      await request<BackendSupportTicket>('/support-tickets/', {
        method: 'POST',
        body: { subject, message, attachments },
      }),
    );
  },

  async getNotifications(): Promise<AppNotification[]> {
    const r = await request<BackendNotification[]>('/notifications/');
    return r.map(mapNotification);
  },

  async markNotificationsRead(): Promise<void> {
    await request<void>('/notifications/read-all', { method: 'PATCH' });
  },

  async getUnreadNotificationsCount(): Promise<number> {
    const r = await request<{ count: number }>('/notifications/unread-count');
    return r.count;
  },
};
