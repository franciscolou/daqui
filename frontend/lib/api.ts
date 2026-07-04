import { getItem, removeItem, setItem } from './storage';
import { Poll, Post, PostCategory, User } from '../data/mock';

// ─────────────────────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────────────────────
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ??
  'http://localhost:8000/api/v1';

export type SearchType = 'all' | 'posts' | 'users';

const TOKEN_KEY = 'daqui.token';

let token: string | null = null;

export async function loadToken(): Promise<string | null> {
  token = await getItem(TOKEN_KEY);
  return token;
}

export async function setToken(value: string | null): Promise<void> {
  token = value;
  if (value) await setItem(TOKEN_KEY, value);
  else await removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return token;
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

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
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

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message)) || `Erro ${res.status}`;
    throw new ApiError(res.status, typeof detail === 'string' ? detail : 'Erro');
  }
  return data as T;
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
  neighborhood: string;
  city?: string | null;
  state?: string | null;
  badge: string | null;
  verified: boolean;
  posts_count: number;
  help_count: number;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  locked?: boolean;
  email?: string;
  two_factor_enabled?: boolean;
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

interface BackendPost {
  id: number;
  category: string;
  title: string | null;
  content: string;
  image_url: string | null;
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
  liked: boolean;
  poll: BackendPoll | null;
}

interface BackendComment {
  id: number;
  post_id: number;
  content: string;
  created_at: string;
  author: BackendUser;
}

export interface Comment {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  author: User;
}

interface BackendConversation {
  user: BackendUser;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface BackendSharedPost {
  id: number;
  category: string;
  title: string | null;
  content: string;
  image_url: string | null;
  created_at: string;
  author: BackendUser;
}

interface BackendMessage {
  id: number;
  content: string;
  read: boolean;
  created_at: string;
  sender: BackendUser;
  shared_post: BackendSharedPost | null;
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
  name: string;
  description: string;
  avatar_url: string | null;
  is_open: boolean;
  owner_id: number;
  neighborhood: string;
  members_count: number;
  created_at: string;
  my_role: string | null;
}

interface BackendGroupMember {
  user: BackendUser;
  role: string;
  joined_at: string;
}

interface BackendGroupDetail extends BackendGroup {
  members: BackendGroupMember[];
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
  created_at: string;
  sender: BackendUser;
}

interface BackendNotification {
  id: number;
  type: string;
  content: string;
  target_text: string | null;
  read: boolean;
  post_id: number | null;
  created_at: string;
  actor: BackendUser | null;
}

export interface Conversation {
  user: User;
  lastMessage: string;
  time: string;
  unread: number;
}

// Prévia de um post encaminhado dentro de uma mensagem (estilo Twitter).
export interface SharedPost {
  id: string;
  category: PostCategory;
  title?: string;
  content: string;
  image?: string;
  createdAt: string;
  author: User;
}

export interface ChatMessage {
  id: string;
  content: string;
  read: boolean;
  createdAt: string;
  sender: User;
  sharedPost?: SharedPost;
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

// Resultado de login: token direto, ou pedido de 2º fator (A2F) com um ticket.
export type LoginResult =
  | { status: 'ok'; token: string }
  | { status: '2fa'; ticket: string };

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

export interface NearbyNeighborhood {
  neighborhood: string;
  latitude: number;
  longitude: number;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
}

export type GroupRole = 'owner' | 'admin' | 'member';

export interface Group {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  isOpen: boolean;
  ownerId: string;
  neighborhood: string;
  membersCount: number;
  createdAt: string;
  myRole: GroupRole | null; // papel do usuário logado (null se não for membro)
}

export interface GroupMember {
  user: User;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupDetail extends Group {
  members: GroupMember[];
}

export interface GroupConversation {
  group: Group;
  lastMessage: string;
  time: string;
  unread: number;
}

export interface AppNotification {
  id: string;
  type: string;
  content: string;
  targetText?: string;
  time: string;
  read: boolean;
  postId?: string;
  actor?: User;
}

// ─────────────────────────────────────────────────────────────
// Adaptadores backend → modelos do app (camelCase)
// ─────────────────────────────────────────────────────────────
const FALLBACK_AVATAR = 'https://i.pravatar.cc/150?img=12';

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}m atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function mapUser(u: BackendUser): User {
  return {
    id: String(u.id),
    username: u.username,
    name: u.name,
    bio: u.bio ?? undefined,
    avatar: u.avatar_url || FALLBACK_AVATAR,
    neighborhood: u.neighborhood,
    city: u.city ?? undefined,
    state: u.state ?? undefined,
    badge: (u.badge as User['badge']) ?? undefined,
    verified: u.verified,
    joinedAt: new Date(u.created_at).toLocaleDateString('pt-BR', {
      month: 'short',
      year: 'numeric',
    }),
    postsCount: u.posts_count,
    helpCount: u.help_count,
    latitude: u.latitude ?? undefined,
    longitude: u.longitude ?? undefined,
    locked: u.locked ?? false,
    twoFactorEnabled: u.two_factor_enabled,
  };
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
    author: mapUser(p.author),
    category: p.category as PostCategory,
    title: p.title ?? undefined,
    content: p.content,
    images: p.image_url ? [p.image_url] : undefined,
    createdAt: p.created_at, // ISO — formatado na renderização (lib/time)
    likesCount: p.likes_count,
    commentsCount: p.comments_count,
    sharesCount: p.shares_count,
    neighborhood: p.neighborhood,
    distance: '',
    latitude: p.latitude ?? undefined,
    longitude: p.longitude ?? undefined,
    liked: p.liked,
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
    content: c.content,
    createdAt: c.created_at, // ISO — formatado na renderização (lib/time)
    author: mapUser(c.author),
  };
}

function mapConversation(c: BackendConversation): Conversation {
  return {
    user: mapUser(c.user),
    lastMessage: c.last_message,
    time: c.last_message_at, // ISO — formatado na renderização (lib/time)
    unread: c.unread_count,
  };
}

function mapSharedPost(p: BackendSharedPost): SharedPost {
  return {
    id: String(p.id),
    category: p.category as PostCategory,
    title: p.title ?? undefined,
    content: p.content,
    image: p.image_url ?? undefined,
    createdAt: p.created_at,
    author: mapUser(p.author),
  };
}

function mapMessage(m: BackendMessage): ChatMessage {
  return {
    id: String(m.id),
    content: m.content,
    read: m.read,
    createdAt: m.created_at,
    sender: mapUser(m.sender),
    sharedPost: m.shared_post ? mapSharedPost(m.shared_post) : undefined,
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
    name: g.name,
    description: g.description,
    avatar: g.avatar_url ?? undefined,
    isOpen: g.is_open,
    ownerId: String(g.owner_id),
    neighborhood: g.neighborhood,
    membersCount: g.members_count,
    createdAt: g.created_at,
    myRole: (g.my_role as GroupRole | null) ?? null,
  };
}

function mapGroupMember(m: BackendGroupMember): GroupMember {
  return { user: mapUser(m.user), role: m.role as GroupRole, joinedAt: m.joined_at };
}

function mapGroupDetail(g: BackendGroupDetail): GroupDetail {
  return { ...mapGroup(g), members: (g.members ?? []).map(mapGroupMember) };
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
    read: true,
    createdAt: m.created_at,
    sender: mapUser(m.sender),
  };
}

function mapNotification(n: BackendNotification): AppNotification {
  return {
    id: String(n.id),
    type: n.type,
    content: n.content,
    targetText: n.target_text ?? undefined,
    time: relativeTime(n.created_at),
    read: n.read,
    postId: n.post_id != null ? String(n.post_id) : undefined,
    actor: n.actor ? mapUser(n.actor) : undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// Endpoints
// ─────────────────────────────────────────────────────────────
export const api = {
  async signup(payload: {
    name: string;
    username: string;
    email: string;
    password: string;
    neighborhood: string;
    city: string;
    state?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<string> {
    const r = await request<{ access_token: string }>('/auth/signup', {
      method: 'POST',
      body: payload,
      auth: false,
    });
    return r.access_token;
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

  async login(email: string, password: string): Promise<LoginResult> {
    const r = await request<{
      requires_2fa: boolean;
      ticket: string | null;
      access_token: string | null;
    }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
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

  async me(): Promise<User> {
    return mapUser(await request<BackendUser>('/auth/me'));
  },

  async updateProfile(payload: {
    username?: string;
    name?: string;
    bio?: string;
    neighborhood?: string;
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

  async getNeighborhoodStats(): Promise<NeighborhoodStats> {
    return request<NeighborhoodStats>('/users/neighborhood-stats');
  },

  async getFeed(category?: string): Promise<Post[]> {
    const q = category && category !== 'todos' ? `?category=${category}` : '';
    const r = await request<{ items: BackendPost[] }>(`/posts/feed${q}`);
    return r.items.map(mapPost);
  },

  async getPost(id: string): Promise<Post> {
    return mapPost(await request<BackendPost>(`/posts/${id}`));
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

  async getMapPosts(): Promise<Post[]> {
    const r = await request<BackendPost[]>('/posts/map');
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
    const r = await request<NearbyNeighborhood[]>('/geo/nearby', {
      method: 'POST',
      body: { latitude, longitude },
      auth: false,
    });
    return r.map((n) => ({
      neighborhood: n.neighborhood,
      latitude: n.latitude,
      longitude: n.longitude,
    }));
  },

  // Valida um endereço contra o bairro do usuário logado (ao publicar).
  async geocode(address: string): Promise<GeocodeResult> {
    return request<GeocodeResult>('/geo/geocode', {
      method: 'POST',
      body: { address },
    });
  },

  async toggleLike(id: string): Promise<Post> {
    return mapPost(await request<BackendPost>(`/posts/${id}/like`, { method: 'POST' }));
  },

  async createPost(payload: {
    category: string;
    title?: string;
    content: string;
    image_url?: string;
    image?: string; // data URL base64 (ex.: imagem do produto)
    details?: Record<string, any>;
    important?: boolean;
    poll?: { options: string[]; multiple: boolean; closes_at: string };
  }): Promise<Post> {
    return mapPost(await request<BackendPost>('/posts/', { method: 'POST', body: payload }));
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

  async getUserPosts(id: string): Promise<Post[]> {
    const r = await request<BackendPost[]>(`/users/${id}/posts`);
    return r.map(mapPost);
  },

  async listComments(postId: string): Promise<Comment[]> {
    const r = await request<BackendComment[]>(`/posts/${postId}/comments`);
    return r.map(mapComment);
  },

  async addComment(postId: string, content: string): Promise<Comment> {
    return mapComment(
      await request<BackendComment>(`/posts/${postId}/comments`, {
        method: 'POST',
        body: { content },
      }),
    );
  },

  async getConversations(): Promise<Conversation[]> {
    const r = await request<BackendConversation[]>('/messages/conversations');
    return r.map(mapConversation);
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

  async sendMessage(
    receiverId: string,
    content: string,
    sharedPostId?: string,
  ): Promise<ChatMessage> {
    return mapMessage(
      await request<BackendMessage>('/messages/', {
        method: 'POST',
        body: {
          receiver_id: Number(receiverId),
          content,
          shared_post_id: sharedPostId ? Number(sharedPostId) : undefined,
        },
      }),
    );
  },

  // ── Grupos ────────────────────────────────────────────────
  async createGroup(payload: {
    name: string;
    description?: string;
    isOpen: boolean;
    memberIds?: string[];
  }): Promise<GroupDetail> {
    return mapGroupDetail(
      await request<BackendGroupDetail>('/groups/', {
        method: 'POST',
        body: {
          name: payload.name,
          description: payload.description ?? '',
          is_open: payload.isOpen,
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

  async updateGroup(
    id: string,
    payload: { name?: string; description?: string; isOpen?: boolean },
  ): Promise<GroupDetail> {
    return mapGroupDetail(
      await request<BackendGroupDetail>(`/groups/${id}`, {
        method: 'PATCH',
        body: {
          name: payload.name,
          description: payload.description,
          is_open: payload.isOpen,
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

  async joinGroup(id: string): Promise<GroupDetail> {
    return mapGroupDetail(
      await request<BackendGroupDetail>(`/groups/${id}/join`, { method: 'POST' }),
    );
  },

  async leaveGroup(id: string): Promise<void> {
    await request<void>(`/groups/${id}/leave`, { method: 'POST' });
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

  async sendGroupMessage(id: string, content: string): Promise<ChatMessage> {
    return mapGroupMessage(
      await request<BackendGroupMessage>(`/groups/${id}/messages`, {
        method: 'POST',
        body: { content },
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
};
