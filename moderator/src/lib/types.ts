// Formatos de resposta do backend do Daqui usados pelo painel de moderação.

export interface UserRef {
  id: number;
  username: string;
  avatar_url?: string | null;
  neighborhood?: string | null;
}

export interface Attachment {
  url: string;
  type: 'image' | 'video';
}

export interface Review {
  id: number;
  rating: number;
  comment?: string | null;
  updated_at: string;
  author: UserRef;
}

export interface ReviewStats {
  total: number;
  average?: number | null;
}

export interface ReportPost {
  id: number;
  title?: string | null;
  content: string;
  author: UserRef;
}

export interface ReportComment {
  id: number;
  content: string;
  post_id: number;
  author: UserRef;
}

export interface Report {
  id: number;
  status: string;
  reason: string;
  target_type: 'post' | 'comment' | 'user';
  comment?: string | null;
  created_at: string;
  reporter: UserRef;
  post?: ReportPost | null;
  comment_target?: ReportComment | null;
  reported_user?: UserRef | null;
  attachments?: Attachment[] | null;
}

export interface CountStats {
  total: number;
  pending: number;
}

export interface Ticket {
  id: number;
  status: string;
  subject: string;
  message: string;
  response?: string | null;
  responded_at?: string | null;
  created_at: string;
  user: UserRef;
  attachments?: Attachment[] | null;
}

export interface AuditLog {
  id: number;
  action: string;
  detail?: string | null;
  created_at: string;
  moderator: UserRef;
  target_user?: UserRef | null;
}

export interface AdminUser extends UserRef {
  created_at: string;
  posts_count: number;
  interactions_count: number;
  is_suspended: boolean;
  suspended_until?: string | null;
  suspension_reason?: string | null;
}

export interface UserPost {
  id: number;
  title?: string | null;
  content: string;
  category: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
}

export interface UserComment {
  id: number;
  content: string;
  post_id: number;
  created_at: string;
}

export interface StaffAccount {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  staff_role: string;
  is_suspended: boolean;
  suspension_reason?: string | null;
  created_at: string;
}

export interface Me {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  staff_role?: string | null;
  two_factor_enabled: boolean;
}

export interface TwofaSetup {
  secret: string;
  otpauth_url: string;
}
