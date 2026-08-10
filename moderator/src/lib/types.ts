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

export interface ReportedAd {
  id: number;
  status: string;
  advertiser_name: string;
  advertiser_email: string;
  title: string;
  content: string;
  image_url?: string | null;
  video_url?: string | null;
  target_url: string;
  linked_user_id?: number | null;
}

export interface Report {
  id: number;
  status: string;
  reason: string;
  target_type: 'post' | 'comment' | 'user' | 'ad';
  comment?: string | null;
  created_at: string;
  reporter: UserRef;
  post?: ReportPost | null;
  comment_target?: ReportComment | null;
  reported_user?: UserRef | null;
  ad?: ReportedAd | null;
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

export interface TrashItem {
  id: number;
  type: 'post' | 'comment';
  title?: string | null;
  content: string;
  created_at: string;
  deleted_at: string;
  expires_at: string;
  author: UserRef;
  deleted_by: UserRef;
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

export interface DailyActiveUsers {
  date: string;
  count: number;
}

export interface ScreenTime {
  screen: string;
  avg_duration_seconds: number;
  views: number;
}

export interface ScreenExit {
  screen: string;
  exits: number;
}

export interface ClickStat {
  label: string;
  screen?: string | null;
  count: number;
}

export interface SearchStat {
  query: string;
  count: number;
}

export interface PlatformStat {
  platform: string;
  active_users: number;
}

export interface HourlyStat {
  hour: string;
  count: number;
}

export interface AnalyticsOverview {
  date_from: string;
  date_to: string;
  active_users: number;
  total_sessions: number;
  avg_session_duration_seconds: number;
  total_searches: number;
  total_clicks: number;
  new_users: number;
  returning_users: number;
  avg_screens_per_session: number;
  daily_active_users: DailyActiveUsers[];
  top_screens: ScreenTime[];
  top_exit_screens: ScreenExit[];
  top_clicks: ClickStat[];
  top_searches: SearchStat[];
  platform_breakdown: PlatformStat[];
  hourly_activity: HourlyStat[];
}

export interface TwofaSetup {
  secret: string;
  otpauth_url: string;
}
