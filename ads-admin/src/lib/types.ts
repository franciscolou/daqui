// Formatos de resposta do ads-backend usados pelo painel.

export interface Creative {
  id: number;
  title: string;
  content: string;
  format?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  weight: number;
  is_active: boolean;
  impressions_count: number;
  clicks_count: number;
}

export interface Targeting {
  geo_scope: string;
  neighborhoods?: string[] | null;
  city?: string | null;
  cities?: string[] | null;
}

export interface Campaign {
  id: number;
  status: string;
  objective: string;
  priority: number;
  formats: string[];
  price_cents: number;
  starts_at: string;
  ends_at: string;
  impressions_count: number;
  clicks_count: number;
  advertiser_name: string;
  advertiser_email: string;
  access_token: string;
  renewed_from_id?: number | null;
  targeting: Targeting;
  creatives?: Creative[] | null;
}

export interface Bucket {
  key: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface CampaignAnalytics {
  summary: {
    impressions: number;
    clicks: number;
    ctr: number;
    cpc_cents?: number | null;
    cpm_cents?: number | null;
  };
  buckets: Bucket[];
  actions?: Record<string, number> | null;
}

export interface AnalyticsRow {
  advertiser_name: string;
  advertiser_email: string;
  status: string;
  category: string;
  objective: string;
  price_cents: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc_cents?: number | null;
  starts_at: string;
}

export interface AnalyticsOverview {
  summary: {
    revenue_cents: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc_cents?: number | null;
    active_campaigns: number;
    campaigns_count: number;
  };
  insights: string[];
  timeseries: Bucket[];
  by_format: Bucket[];
  by_objective: Bucket[];
  by_category: Bucket[];
  top_neighborhoods: Bucket[];
  campaigns: AnalyticsRow[];
  advertisers: string[];
}

export interface Plan {
  id: number;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  duration_days: number;
  formats: string[];
  geo_scope: string;
  max_neighborhoods?: number | null;
  max_cities?: number | null;
  sort_order: number;
  category?: string | null;
  badge?: string | null;
  is_public: boolean;
}

export interface StaffAccount {
  id: number;
  email: string;
  username: string;
  avatar_url?: string | null;
  role: string;
  is_suspended: boolean;
  created_at: string;
}

export interface AdsSettings {
  price_multiplier: number;
}

export interface TwofaSetup {
  secret: string;
  otpauth_url: string;
}
