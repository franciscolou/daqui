import { getItem, removeItem, setItem } from './storage';
import { Post, PostCategory, User } from '../data/mock';

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
  name: string;
  avatar_url: string | null;
  neighborhood: string;
  badge: string | null;
  verified: boolean;
  posts_count: number;
  help_count: number;
  created_at: string;
  email?: string;
}

interface BackendPost {
  id: number;
  category: string;
  title: string | null;
  content: string;
  image_url: string | null;
  neighborhood: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  urgent: boolean;
  pinned: boolean;
  created_at: string;
  author: BackendUser;
  liked: boolean;
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

interface BackendMessage {
  id: number;
  content: string;
  read: boolean;
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

export interface ChatMessage {
  id: string;
  content: string;
  read: boolean;
  createdAt: string;
  sender: User;
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
    name: u.name,
    avatar: u.avatar_url || FALLBACK_AVATAR,
    neighborhood: u.neighborhood,
    badge: (u.badge as User['badge']) ?? undefined,
    verified: u.verified,
    joinedAt: new Date(u.created_at).toLocaleDateString('pt-BR', {
      month: 'short',
      year: 'numeric',
    }),
    postsCount: u.posts_count,
    helpCount: u.help_count,
  };
}

function mapPost(p: BackendPost): Post {
  return {
    id: String(p.id),
    author: mapUser(p.author),
    category: p.category as PostCategory,
    title: p.title ?? undefined,
    content: p.content,
    images: p.image_url ? [p.image_url] : undefined,
    createdAt: relativeTime(p.created_at),
    likesCount: p.likes_count,
    commentsCount: p.comments_count,
    sharesCount: p.shares_count,
    neighborhood: p.neighborhood,
    distance: '',
    liked: p.liked,
    pinned: p.pinned,
    urgent: p.urgent,
  };
}

function mapComment(c: BackendComment): Comment {
  return {
    id: String(c.id),
    postId: String(c.post_id),
    content: c.content,
    createdAt: relativeTime(c.created_at),
    author: mapUser(c.author),
  };
}

function mapConversation(c: BackendConversation): Conversation {
  return {
    user: mapUser(c.user),
    lastMessage: c.last_message,
    time: relativeTime(c.last_message_at),
    unread: c.unread_count,
  };
}

function mapMessage(m: BackendMessage): ChatMessage {
  return {
    id: String(m.id),
    content: m.content,
    read: m.read,
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
    email: string;
    password: string;
    neighborhood: string;
    city: string;
  }): Promise<string> {
    const r = await request<{ access_token: string }>('/auth/signup', {
      method: 'POST',
      body: payload,
      auth: false,
    });
    return r.access_token;
  },

  async login(email: string, password: string): Promise<string> {
    const r = await request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    return r.access_token;
  },

  async me(): Promise<User> {
    return mapUser(await request<BackendUser>('/auth/me'));
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

  async getTopUrgent(): Promise<Post | null> {
    const p = await request<BackendPost | null>('/posts/urgent');
    return p ? mapPost(p) : null;
  },

  async toggleLike(id: string): Promise<Post> {
    return mapPost(await request<BackendPost>(`/posts/${id}/like`, { method: 'POST' }));
  },

  async createPost(payload: {
    category: string;
    title?: string;
    content: string;
    image_url?: string;
    urgent?: boolean;
  }): Promise<Post> {
    return mapPost(await request<BackendPost>('/posts/', { method: 'POST', body: payload }));
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

  async getThread(userId: string): Promise<ChatMessage[]> {
    const r = await request<BackendMessage[]>(`/messages/${userId}`);
    return r.map(mapMessage);
  },

  async sendMessage(receiverId: string, content: string): Promise<ChatMessage> {
    return mapMessage(
      await request<BackendMessage>('/messages/', {
        method: 'POST',
        body: { receiver_id: Number(receiverId), content },
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
