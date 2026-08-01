// Rótulos em português dos enums do ads-backend, num só lugar.

export const FORMAT_LABEL: Record<string, string> = {
  post: 'Post + mapa',
  conversation: 'Conversa (Mensagens)',
  notification: 'Novidades',
  search_poster: 'Poster de busca',
};
export const ALL_FORMATS = Object.keys(FORMAT_LABEL);

export const OBJECTIVE_LABEL: Record<string, string> = {
  reach: 'Alcance',
  clicks: 'Cliques',
  profile_visits: 'Visitas ao perfil',
  map_opens: 'Abertura do mapa',
  whatsapp_opens: 'Abertura do WhatsApp',
  instagram_opens: 'Abertura do Instagram',
  website_opens: 'Abertura do site',
};

export const CATEGORY_LABEL: Record<string, string> = {
  local_business: 'Comércio local',
  event: 'Anuncie seu evento',
  enterprise: 'Grandes empresas',
  national: 'Alcance nacional',
  personalizado: 'Personalizado',
};

export const PLAN_CATEGORIES = [
  { key: 'local_business', label: 'Comércio local' },
  { key: 'event', label: 'Anuncie seu evento' },
  { key: 'enterprise', label: 'Grandes empresas' },
  { key: 'national', label: 'Alcance nacional' },
];

export interface StatusFilter {
  key: string;
  label: string;
}

export const CAMPAIGN_STATUS_FILTERS: StatusFilter[] = [
  { key: '', label: 'Todas' },
  { key: 'active', label: 'Ativas' },
  { key: 'pending_payment', label: 'Aguardando pagamento' },
  { key: 'paused', label: 'Pausadas' },
  { key: 'expired', label: 'Expiradas' },
  { key: 'rejected', label: 'Rejeitadas' },
];

export const CAMPAIGN_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  CAMPAIGN_STATUS_FILTERS.filter((f) => f.key).map((f) => [f.key, f.label]),
);

/** Cor do badge por status de campanha. */
export function statusTone(status: string): 'green' | 'amber' | 'red' | 'neutral' {
  if (status === 'active') return 'green';
  if (status === 'pending_payment') return 'amber';
  if (status === 'expired' || status === 'rejected') return 'red';
  return 'neutral';
}

export const GEO_SCOPES = [
  { key: 'neighborhood', label: 'Bairros' },
  { key: 'citywide', label: 'Cidade toda' },
  { key: 'cities', label: 'Várias cidades' },
  { key: 'country', label: 'Brasil todo' },
] as const;

export type GeoScope = (typeof GEO_SCOPES)[number]['key'];

export const STAFF_RANK: Record<string, number> = {
  moderador: 1,
  administrador: 2,
  owner: 3,
};

export const STAFF_ROLE_LABEL: Record<string, string> = {
  moderador: 'Moderador',
  administrador: 'Administrador',
  owner: 'Owner',
};

/** Resumo textual da segmentação geográfica de uma campanha/plano. */
export function describeGeo(t: {
  geo_scope?: string;
  city?: string | null;
  cities?: string[] | null;
  neighborhoods?: string[] | null;
}): string {
  if (t.geo_scope === 'country') return 'Brasil todo';
  if (t.geo_scope === 'cities') return (t.cities || []).join(', ') || '—';
  if (t.geo_scope === 'citywide') return t.city || 'Cidade toda';
  return (t.neighborhoods || []).join(', ') || '—';
}
