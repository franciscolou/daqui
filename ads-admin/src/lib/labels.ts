// Rótulos em português dos enums do ads-backend, num só lugar.

export const FORMAT_LABEL: Record<string, string> = {
  post: 'Post no feed',
  map: 'Pin no mapa',
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
  { key: 'awaiting_content', label: 'Aguardando conteúdo' },
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
  if (status === 'awaiting_content' || status === 'pending_payment') return 'amber';
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

// Filtros predefinidos da Auditoria, separados em dois grupos (ver Audit.tsx):
// i) gerenciamento do propósito da plataforma — campanhas/planos de anúncio —
// e ii) contas do próprio painel (staff). "Todas" mora no primeiro grupo por
// convenção (era a primeira opção da lista única, antes da separação).
export const AUDIT_ACTION_FILTERS_PLATFORM = [
  { key: '', label: 'Todas' },
  { key: 'campaign_pause', label: 'Campanha pausada' },
  { key: 'campaign_reactivate', label: 'Campanha reativada' },
  { key: 'plan_create', label: 'Criação de plano' },
  { key: 'plan_update', label: 'Edição de plano' },
  { key: 'plan_delete', label: 'Exclusão de plano' },
  { key: 'proposal_create', label: 'Proposta manual' },
  { key: 'proposal_content_submitted', label: 'Conteúdo da proposta preenchido' },
  { key: 'proposal_activated', label: 'Proposta ativada' },
];

export const AUDIT_ACTION_FILTERS_STAFF = [
  { key: 'staff_invite', label: 'Convite de conta de staff' },
  { key: 'staff_invite_accepted', label: 'Ativação de conta de staff' },
  { key: 'staff_username_change', label: 'Troca de usuário de staff' },
  { key: 'staff_suspend', label: 'Suspensão de conta de staff' },
  { key: 'staff_unsuspend', label: 'Reativação de conta de staff' },
  { key: 'staff_delete', label: 'Exclusão de conta de staff' },
];

export const AUDIT_ACTION_FILTERS = [
  ...AUDIT_ACTION_FILTERS_PLATFORM,
  ...AUDIT_ACTION_FILTERS_STAFF,
];

export const AUDIT_ACTION_LABEL: Record<string, string> = Object.fromEntries(
  AUDIT_ACTION_FILTERS.filter((f) => f.key).map((f) => [f.key, f.label]),
);

// Verbo usado na frase-resumo de cada ação. Ações de campanha/plano não têm
// "alvo" de staff (o alvo é um anunciante, só texto em `detail`), então só
// entram no mapa "sem alvo"; convite/troca/suspensão de conta de staff têm
// as duas variantes, como no registro de auditoria da moderação.
export const AUDIT_ACTION_VERB: Record<string, string> = {
  // Alvo é a própria conta recém-criada (quem ativa o convite é quem o
  // aceita) — o texto evita "ativou o convite de @fulano" repetindo @fulano.
  staff_invite_accepted: 'ativou o convite e criou a própria conta de staff:',
  staff_username_change: 'alterou o nome de usuário de',
  staff_suspend: 'suspendeu a conta de staff de',
  staff_unsuspend: 'reativou a conta de staff de',
  staff_delete: 'excluiu a conta de staff de',
};

export const AUDIT_ACTION_VERB_NO_TARGET: Record<string, string> = {
  campaign_pause: 'pausou uma campanha',
  campaign_reactivate: 'reativou uma campanha',
  plan_create: 'criou um plano',
  plan_update: 'editou um plano',
  plan_delete: 'excluiu um plano',
  proposal_create: 'inseriu uma proposta manual',
  proposal_content_submitted: 'o anunciante preencheu o conteúdo de uma proposta',
  proposal_activated: 'uma campanha de proposta manual foi ativada',
  staff_invite: 'convidou uma nova conta de staff',
  staff_username_change: 'alterou o nome de usuário de uma conta de staff',
  staff_suspend: 'suspendeu uma conta de staff',
  staff_unsuspend: 'reativou uma conta de staff',
  staff_delete: 'excluiu uma conta de staff',
};

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

// Opções do filtro de cargo na tela de Equipe — mesma ordem de STAFF_RANK,
// do mais alto pro mais baixo (Owner primeiro).
export const STAFF_ROLE_FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'owner', label: 'Owner' },
  { key: 'administrador', label: 'Administrador' },
  { key: 'moderador', label: 'Moderador' },
];

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
