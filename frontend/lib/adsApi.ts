// Cliente do ads-backend — um serviço HTTP separado do backend do Daqui
// (ver plano de infraestrutura de anunciantes). Por isso este arquivo, e não
// lib/api.ts: aqui há literalmente dois backends distintos.

import { Platform } from 'react-native';

export const ADS_API_URL =
  process.env.EXPO_PUBLIC_ADS_API_URL?.replace(/\/$/, '') ??
  'http://localhost:8001/api/v1';

export class AdsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { method = 'GET', body } = options;
  let res: Response;
  try {
    res = await fetch(`${ADS_API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AdsApiError(0, 'Não foi possível conectar ao servidor de anúncios.');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail = (data && (data.detail || data.message)) || `Erro ${res.status}`;
    throw new AdsApiError(res.status, typeof detail === 'string' ? detail : 'Erro');
  }
  return data as T;
}

// Upload multipart (imagem/vídeo do criativo) — não passa pelo `request`
// acima porque o Content-Type (com boundary) precisa vir do próprio fetch
// a partir do FormData, não fixado como "application/json".
export interface PickedAdMediaAsset {
  uri: string;
  mimeType?: string;
  fileName?: string;
}

async function requestMultipart<T>(path: string, formData: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ADS_API_URL}${path}`, { method: 'POST', body: formData });
  } catch {
    throw new AdsApiError(0, 'Não foi possível conectar ao servidor de anúncios.');
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = (data && (data.detail || data.message)) || `Erro ${res.status}`;
    throw new AdsApiError(res.status, typeof detail === 'string' ? detail : 'Erro');
  }
  return data as T;
}

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
export type AdFormat = 'post' | 'conversation' | 'notification' | 'search_poster';
// Pessoa Física (CPF) ou Jurídica (CNPJ) — ver checkout.tsx / ads-backend.
export type AdvertiserType = 'individual' | 'company';
export type AdObjective =
  | 'reach'
  | 'clicks'
  | 'profile_visits'
  | 'map_opens'
  | 'whatsapp_opens'
  | 'instagram_opens'
  | 'website_opens';

interface BackendAd {
  id: number;
  creative_id: number;
  objective: AdObjective;
  title: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  cta_label: string | null;
  target_url: string;
  latitude: number | null;
  longitude: number | null;
  linked_user_id: number | null;
}

export interface Ad {
  id: number;
  creativeId: number;
  objective: AdObjective;
  title: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  ctaLabel?: string;
  targetUrl: string;
  latitude?: number;
  longitude?: number;
  // Conta do Daqui vinculada (só formato "post") — id de User, resolvido
  // pelo frontend via api.getUser(id) pra renderizar como um post real.
  linkedUserId?: number;
}

function mapAd(b: BackendAd): Ad {
  return {
    id: b.id,
    creativeId: b.creative_id,
    objective: b.objective,
    title: b.title,
    content: b.content,
    imageUrl: b.image_url ?? undefined,
    videoUrl: b.video_url ?? undefined,
    ctaLabel: b.cta_label ?? undefined,
    targetUrl: b.target_url,
    latitude: b.latitude ?? undefined,
    longitude: b.longitude ?? undefined,
    linkedUserId: b.linked_user_id ?? undefined,
  };
}

interface BackendAdPlan {
  id: number;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  currency: string;
  duration_days: number;
  formats: AdFormat[];
  max_neighborhoods: number | null;
  sort_order: number;
  category: string | null;
  badge: string | null;
}

export type AdPlanCategory = 'local_business' | 'event' | 'enterprise';

export interface AdPlan {
  id: number;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  currency: string;
  durationDays: number;
  formats: AdFormat[];
  maxNeighborhoods: number | null;
  category?: AdPlanCategory;
  badge?: string;
}

function mapAdPlan(b: BackendAdPlan): AdPlan {
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    description: b.description,
    priceCents: b.price_cents,
    currency: b.currency,
    durationDays: b.duration_days,
    formats: b.formats,
    maxNeighborhoods: b.max_neighborhoods,
    category: (b.category as AdPlanCategory) ?? undefined,
    badge: b.badge ?? undefined,
  };
}

// ── Segmentação/agenda avançadas — "Configurações avançadas" no personalizar ──
export interface TargetingParams {
  includeNearby?: boolean;
  radiusKm?: number;
  centerLat?: number;
  centerLng?: number;
  audience?: 'all' | 'residents' | 'visitors';
  categories?: string[];
  groupIds?: number[];
  userRecency?: 'all' | 'new' | 'returning';
  engagement?: 'any' | 'active';
}

export interface ScheduleParams {
  hours?: number[] | null;
  daysOfWeek?: number[] | null;
  specialDates?: string[];
}

function targetingBody(citywide: boolean, neighborhoods: string[], t?: TargetingParams) {
  return {
    citywide,
    neighborhoods,
    include_nearby: t?.includeNearby ?? false,
    radius_km: t?.radiusKm ?? null,
    center_lat: t?.centerLat ?? null,
    center_lng: t?.centerLng ?? null,
    audience: t?.audience ?? 'all',
    categories: t?.categories ?? [],
    group_ids: t?.groupIds ?? [],
    user_recency: t?.userRecency ?? 'all',
    engagement: t?.engagement ?? 'any',
  };
}

function scheduleBody(s?: ScheduleParams) {
  return {
    hours: s?.hours ?? null,
    days_of_week: s?.daysOfWeek ?? null,
    special_dates: s?.specialDates ?? [],
  };
}

export interface QuoteParams {
  formats: AdFormat[];
  durationDays: number;
  neighborhoods: string[];
  citywide: boolean;
  targeting?: TargetingParams;
  schedule?: ScheduleParams;
  objective?: AdObjective;
  priority?: number;
  dailyImpressionCap?: number;
  perUserImpressionCap?: number;
}

export interface PriceFactor {
  label: string;
  multiplier: number;
}

export interface QuoteResult {
  priceCents: number;
  currency: string;
  baseCents: number;
  factors: PriceFactor[];
}

export interface CreativeInput {
  format?: AdFormat;
  title: string;
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  ctaLabel?: string;
  targetUrl: string;
  latitude?: number;
  longitude?: number;
  linkedUserId?: number;
  weight?: number;
}

export interface CheckoutParams extends QuoteParams {
  planId?: number;
  advertiserName: string;
  advertiserEmail: string;
  advertiserPhone: string;
  advertiserType: AdvertiserType;
  advertiserDocument: string;
  rotationWeight?: number;
  pacing?: 'asap' | 'even';
  // Um bloco fixo por formato (sem teste A/B — ver AdCreativeEditor).
  creatives: CreativeInput[];
  // Se preenchido, esta contratação é uma reativação da campanha desse token.
  renewedFromToken?: string;
}

function creativeBody(c: CreativeInput) {
  return {
    format: c.format ?? null,
    title: c.title,
    content: c.content ?? '',
    image_url: c.imageUrl ?? null,
    video_url: c.videoUrl ?? null,
    cta_label: c.ctaLabel ?? null,
    target_url: c.targetUrl,
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    linked_user_id: c.linkedUserId ?? null,
    weight: c.weight ?? 1,
  };
}

// ── Painel do anunciante (`/anunciar/painel/[token]`) ──────────────────
export type CampaignStatus = 'pending_payment' | 'active' | 'paused' | 'expired' | 'rejected';

export interface MyCampaignCreative {
  id: number;
  format?: AdFormat;
  title: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  ctaLabel?: string;
  targetUrl: string;
  latitude?: number;
  longitude?: number;
  linkedUserId?: number;
  isActive: boolean;
  impressionsCount: number;
  clicksCount: number;
}

export interface AnalyticsBucket {
  key: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface CampaignHistoryPeriod {
  id: number;
  accessToken: string;
  status: CampaignStatus;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  impressionsCount: number;
  clicksCount: number;
  priceCents: number;
}

export interface MyCampaign {
  id: number;
  status: CampaignStatus;
  advertiserName: string;
  advertiserEmail: string;
  advertiserPhone: string;
  advertiserType: AdvertiserType;
  advertiserDocument: string;
  formats: AdFormat[];
  priceCents: number;
  currency: string;
  citywide: boolean;
  neighborhoods: string[];
  objective: AdObjective;
  priority: number;
  rotationWeight: number;
  pacing: 'asap' | 'even';
  dailyImpressionCap?: number;
  perUserImpressionCap?: number;
  durationDays: number;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  creatives: MyCampaignCreative[];
  analytics: {
    impressions: number;
    clicks: number;
    ctr: number;
    cpcCents: number | null;
    cpmCents: number | null;
    buckets: AnalyticsBucket[];
  };
  history: CampaignHistoryPeriod[];
}

interface BackendMyCampaign {
  id: number;
  status: CampaignStatus;
  advertiser_name: string;
  advertiser_email: string;
  advertiser_phone: string;
  advertiser_type: AdvertiserType;
  advertiser_document: string;
  formats: AdFormat[];
  price_cents: number;
  currency: string;
  targeting: { citywide: boolean; neighborhoods: string[] };
  objective: AdObjective;
  priority: number;
  rotation_weight: number;
  pacing: 'asap' | 'even';
  daily_impression_cap: number | null;
  per_user_impression_cap: number | null;
  duration_days: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  creatives: {
    id: number;
    format: AdFormat | null;
    title: string;
    content: string;
    image_url: string | null;
    video_url: string | null;
    cta_label: string | null;
    target_url: string;
    latitude: number | null;
    longitude: number | null;
    linked_user_id: number | null;
    is_active: boolean;
    impressions_count: number;
    clicks_count: number;
  }[];
  analytics: {
    summary: {
      impressions: number;
      clicks: number;
      ctr: number;
      cpc_cents: number | null;
      cpm_cents: number | null;
    };
    buckets: AnalyticsBucket[];
  };
  history: {
    id: number;
    access_token: string;
    status: CampaignStatus;
    starts_at: string | null;
    ends_at: string | null;
    created_at: string;
    impressions_count: number;
    clicks_count: number;
    price_cents: number;
  }[];
}

function mapMyCampaign(b: BackendMyCampaign): MyCampaign {
  return {
    id: b.id,
    status: b.status,
    advertiserName: b.advertiser_name,
    advertiserEmail: b.advertiser_email,
    advertiserPhone: b.advertiser_phone,
    advertiserType: b.advertiser_type,
    advertiserDocument: b.advertiser_document,
    formats: b.formats,
    priceCents: b.price_cents,
    currency: b.currency,
    citywide: b.targeting.citywide,
    neighborhoods: b.targeting.neighborhoods,
    objective: b.objective,
    priority: b.priority,
    rotationWeight: b.rotation_weight,
    pacing: b.pacing,
    dailyImpressionCap: b.daily_impression_cap ?? undefined,
    perUserImpressionCap: b.per_user_impression_cap ?? undefined,
    durationDays: b.duration_days,
    startsAt: b.starts_at ?? undefined,
    endsAt: b.ends_at ?? undefined,
    createdAt: b.created_at,
    creatives: b.creatives.map((c) => ({
      id: c.id,
      format: c.format ?? undefined,
      title: c.title,
      content: c.content,
      imageUrl: c.image_url ?? undefined,
      videoUrl: c.video_url ?? undefined,
      ctaLabel: c.cta_label ?? undefined,
      targetUrl: c.target_url,
      latitude: c.latitude ?? undefined,
      longitude: c.longitude ?? undefined,
      linkedUserId: c.linked_user_id ?? undefined,
      isActive: c.is_active,
      impressionsCount: c.impressions_count,
      clicksCount: c.clicks_count,
    })),
    analytics: {
      impressions: b.analytics.summary.impressions,
      clicks: b.analytics.summary.clicks,
      ctr: b.analytics.summary.ctr,
      cpcCents: b.analytics.summary.cpc_cents,
      cpmCents: b.analytics.summary.cpm_cents,
      buckets: b.analytics.buckets,
    },
    history: b.history.map((h) => ({
      id: h.id,
      accessToken: h.access_token,
      status: h.status,
      startsAt: h.starts_at ?? undefined,
      endsAt: h.ends_at ?? undefined,
      createdAt: h.created_at,
      impressionsCount: h.impressions_count,
      clicksCount: h.clicks_count,
      priceCents: h.price_cents,
    })),
  };
}

// ── "Meus anúncios" (sidebar do app, usuário logado — escopado por e-mail) ──
export interface CampaignSummary {
  id: number;
  accessToken: string;
  title: string;
  status: CampaignStatus;
  formats: AdFormat[];
  priceCents: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpcCents: number | null;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
}

export interface MyCampaignsAnalytics {
  summary: {
    campaignsCount: number;
    activeCampaigns: number;
    impressions: number;
    clicks: number;
    ctr: number;
    revenueCents: number;
    cpcCents: number | null;
    cpmCents: number | null;
  };
  timeseries: AnalyticsBucket[];
  byFormat: AnalyticsBucket[];
  campaigns: CampaignSummary[];
  insights: string[];
}

interface BackendMyCampaignsAnalytics {
  summary: {
    campaigns_count: number;
    active_campaigns: number;
    impressions: number;
    clicks: number;
    ctr: number;
    revenue_cents: number;
    cpc_cents: number | null;
    cpm_cents: number | null;
  };
  timeseries: AnalyticsBucket[];
  by_format: AnalyticsBucket[];
  campaigns: {
    id: number;
    access_token: string;
    title: string;
    status: CampaignStatus;
    formats: AdFormat[];
    price_cents: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc_cents: number | null;
    starts_at: string | null;
    ends_at: string | null;
    created_at: string;
  }[];
  insights: string[];
}

function mapMyCampaignsAnalytics(b: BackendMyCampaignsAnalytics): MyCampaignsAnalytics {
  return {
    summary: {
      campaignsCount: b.summary.campaigns_count,
      activeCampaigns: b.summary.active_campaigns,
      impressions: b.summary.impressions,
      clicks: b.summary.clicks,
      ctr: b.summary.ctr,
      revenueCents: b.summary.revenue_cents,
      cpcCents: b.summary.cpc_cents,
      cpmCents: b.summary.cpm_cents,
    },
    timeseries: b.timeseries,
    byFormat: b.by_format,
    campaigns: b.campaigns.map((c) => ({
      id: c.id,
      accessToken: c.access_token,
      title: c.title,
      status: c.status,
      formats: c.formats,
      priceCents: c.price_cents,
      impressions: c.impressions,
      clicks: c.clicks,
      ctr: c.ctr,
      cpcCents: c.cpc_cents,
      startsAt: c.starts_at ?? undefined,
      endsAt: c.ends_at ?? undefined,
      createdAt: c.created_at,
    })),
    insights: b.insights,
  };
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────
export const adsApi = {
  async getAd(
    format: AdFormat,
    params: {
      neighborhood?: string;
      nearbyNeighborhoods?: string[];
      lat?: number;
      lng?: number;
      viewMode?: 'home' | 'nearby';
      category?: string;
      groupIds?: number[];
      engagement?: 'any' | 'active';
      recency?: 'new' | 'returning';
      viewerId?: string;
    } = {},
  ): Promise<Ad | null> {
    const qs = new URLSearchParams();
    if (params.neighborhood) qs.set('neighborhood', params.neighborhood);
    if (params.nearbyNeighborhoods?.length) qs.set('nearby_neighborhoods', params.nearbyNeighborhoods.join(','));
    if (params.lat != null) qs.set('lat', String(params.lat));
    if (params.lng != null) qs.set('lng', String(params.lng));
    if (params.viewMode) qs.set('view_mode', params.viewMode);
    if (params.category) qs.set('category', params.category);
    if (params.groupIds?.length) qs.set('group_ids', params.groupIds.join(','));
    if (params.engagement) qs.set('engagement', params.engagement);
    if (params.recency) qs.set('recency', params.recency);
    if (params.viewerId) qs.set('viewer_id', params.viewerId);
    const query = qs.toString();
    const r = await request<BackendAd | null>(`/ads/active/${format}${query ? `?${query}` : ''}`);
    return r ? mapAd(r) : null;
  },

  // Vários anúncios do mesmo formato (rolagem infinita — ver Busca): prefere
  // campanhas ainda não mostradas (`excludeIds`); quando o pool elegível
  // esgota, o backend volta a sortear entre todas, então a lista nunca "acaba"
  // pra quem continua rolando, só repete.
  async getAds(
    format: AdFormat,
    params: {
      neighborhood?: string;
      nearbyNeighborhoods?: string[];
      lat?: number;
      lng?: number;
      viewMode?: 'home' | 'nearby';
      category?: string;
      groupIds?: number[];
      engagement?: 'any' | 'active';
      recency?: 'new' | 'returning';
      viewerId?: string;
      excludeIds?: number[];
      limit?: number;
    } = {},
  ): Promise<Ad[]> {
    const qs = new URLSearchParams();
    if (params.neighborhood) qs.set('neighborhood', params.neighborhood);
    if (params.nearbyNeighborhoods?.length) qs.set('nearby_neighborhoods', params.nearbyNeighborhoods.join(','));
    if (params.lat != null) qs.set('lat', String(params.lat));
    if (params.lng != null) qs.set('lng', String(params.lng));
    if (params.viewMode) qs.set('view_mode', params.viewMode);
    if (params.category) qs.set('category', params.category);
    if (params.groupIds?.length) qs.set('group_ids', params.groupIds.join(','));
    if (params.engagement) qs.set('engagement', params.engagement);
    if (params.recency) qs.set('recency', params.recency);
    if (params.viewerId) qs.set('viewer_id', params.viewerId);
    if (params.excludeIds?.length) qs.set('exclude_ids', params.excludeIds.join(','));
    if (params.limit != null) qs.set('limit', String(params.limit));
    const query = qs.toString();
    const r = await request<BackendAd[]>(`/ads/active/${format}/list${query ? `?${query}` : ''}`);
    return r.map(mapAd);
  },

  async getAdPlans(): Promise<AdPlan[]> {
    const r = await request<BackendAdPlan[]>('/ads/plans');
    return r.map(mapAdPlan);
  },

  async quoteAd(params: QuoteParams): Promise<QuoteResult> {
    const r = await request<{
      price_cents: number;
      currency: string;
      base_cents: number;
      factors: { label: string; multiplier: number }[];
    }>('/ads/quote', {
      method: 'POST',
      body: {
        formats: params.formats,
        duration_days: params.durationDays,
        neighborhoods: params.neighborhoods,
        citywide: params.citywide,
        targeting: targetingBody(params.citywide, params.neighborhoods, params.targeting),
        schedule: scheduleBody(params.schedule),
        objective: params.objective ?? 'clicks',
        priority: params.priority ?? 3,
        daily_impression_cap: params.dailyImpressionCap ?? null,
        per_user_impression_cap: params.perUserImpressionCap ?? null,
      },
    });
    return {
      priceCents: r.price_cents,
      currency: r.currency,
      baseCents: r.base_cents,
      factors: r.factors,
    };
  },

  async createAdCheckout(params: CheckoutParams): Promise<{ campaignId: number; checkoutUrl: string }> {
    const r = await request<{ campaign_id: number; checkout_url: string }>('/ads/checkout', {
      method: 'POST',
      body: {
        plan_id: params.planId ?? null,
        formats: params.formats,
        duration_days: params.durationDays,
        neighborhoods: params.neighborhoods,
        citywide: params.citywide,
        targeting: targetingBody(params.citywide, params.neighborhoods, params.targeting),
        schedule: scheduleBody(params.schedule),
        objective: params.objective ?? 'clicks',
        priority: params.priority ?? 3,
        rotation_weight: params.rotationWeight ?? 1.0,
        pacing: params.pacing ?? 'asap',
        daily_impression_cap: params.dailyImpressionCap ?? null,
        per_user_impression_cap: params.perUserImpressionCap ?? null,
        advertiser_name: params.advertiserName,
        advertiser_email: params.advertiserEmail,
        advertiser_phone: params.advertiserPhone,
        advertiser_type: params.advertiserType,
        advertiser_document: params.advertiserDocument,
        creatives: params.creatives.map(creativeBody),
        renewed_from_token: params.renewedFromToken ?? null,
      },
    });
    return { campaignId: r.campaign_id, checkoutUrl: r.checkout_url };
  },

  async uploadAdMedia(asset: PickedAdMediaAsset): Promise<{ url: string; type: 'image' | 'video' }> {
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
    return requestMultipart('/ads/media', formData);
  },

  async getMyCampaign(token: string, groupBy: 'hour' | 'weekday' | 'neighborhood' = 'weekday'): Promise<MyCampaign> {
    const r = await request<BackendMyCampaign>(
      `/ads/my-campaign/${encodeURIComponent(token)}?group_by=${groupBy}`,
    );
    return mapMyCampaign(r);
  },

  async updateMyCampaign(
    token: string,
    payload: {
      advertiserName?: string;
      advertiserEmail?: string;
      advertiserPhone?: string;
      advertiserType?: AdvertiserType;
      advertiserDocument?: string;
      creatives?: CreativeInput[];
    },
  ): Promise<MyCampaign> {
    const r = await request<BackendMyCampaign>(`/ads/my-campaign/${encodeURIComponent(token)}`, {
      method: 'PATCH',
      body: {
        advertiser_name: payload.advertiserName ?? null,
        advertiser_email: payload.advertiserEmail ?? null,
        advertiser_phone: payload.advertiserPhone ?? null,
        advertiser_type: payload.advertiserType ?? null,
        advertiser_document: payload.advertiserDocument ?? null,
        creatives: payload.creatives ? payload.creatives.map(creativeBody) : null,
      },
    });
    return mapMyCampaign(r);
  },

  async hasMyCampaigns(email: string): Promise<boolean> {
    const r = await request<{ has_campaigns: boolean }>(
      `/ads/my-campaigns/exists?email=${encodeURIComponent(email)}`,
    );
    return r.has_campaigns;
  },

  async getMyCampaignsAnalytics(
    email: string,
    params: { campaignIds?: number[]; dateFrom?: string; dateTo?: string } = {},
  ): Promise<MyCampaignsAnalytics> {
    const qs = new URLSearchParams({ email });
    if (params.campaignIds?.length) qs.set('campaign_ids', params.campaignIds.join(','));
    if (params.dateFrom) qs.set('date_from', params.dateFrom);
    if (params.dateTo) qs.set('date_to', params.dateTo);
    const r = await request<BackendMyCampaignsAnalytics>(`/ads/my-campaigns?${qs.toString()}`);
    return mapMyCampaignsAnalytics(r);
  },

  async trackAdClick(
    id: number,
    params: { viewerId?: string; creativeId?: number; format?: AdFormat; objectiveAction?: string } = {},
  ): Promise<void> {
    try {
      await request<void>(`/ads/${id}/click`, {
        method: 'POST',
        body: {
          viewer_id: params.viewerId,
          creative_id: params.creativeId,
          format: params.format,
          objective_action: params.objectiveAction,
        },
      });
    } catch {
      // fire-and-forget: uma falha aqui não deve travar a navegação do usuário
    }
  },
};
