// Rótulos em português dos enums do backend, num só lugar.

export const REPORT_STATUS_FILTERS = [
  { key: '', label: 'Todas' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'reviewed', label: 'Revisadas' },
  { key: 'dismissed', label: 'Descartadas' },
];

export const REPORT_TYPE_FILTERS = [
  { key: '', label: 'Todos os tipos' },
  { key: 'post', label: 'Publicações' },
  { key: 'comment', label: 'Comentários' },
  { key: 'user', label: 'Perfis' },
];

export const REPORT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  reviewed: 'Revisada',
  dismissed: 'Descartada',
};

export const REPORT_TARGET_LABEL: Record<string, string> = {
  post: 'Publicação',
  comment: 'Comentário',
  user: 'Perfil',
};

export const REPORT_REASON_LABEL: Record<string, string> = {
  offensive: 'Ofensivo e/ou propaga ódio',
  wrong_category: 'Está na categoria errada',
  spam: 'É spam',
  harmful: 'É nocivo para a comunidade',
  fake: 'É uma conta falsa/fake',
  not_neighbor: 'Essa pessoa não é moradora desse bairro',
  harmful_person: 'Essa pessoa é nociva para a comunidade',
};

export const TICKET_STATUS_FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'answered', label: 'Respondidos' },
];

export const TICKET_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  answered: 'Respondido',
};

export const CATEGORY_LABEL: Record<string, string> = {
  geral: 'Geral',
  aviso: 'Aviso',
  seguranca: 'Segurança',
  evento: 'Evento',
  recomendacao: 'Recomendação',
  venda: 'Venda',
  pets: 'Pets',
  ajuda: 'Ajuda',
  perdidos: 'Perdidos',
  enquete: 'Enquete',
};

// Filtros predefinidos da Auditoria, separados em dois grupos (ver Audit.tsx):
// i) gerenciamento do propósito da plataforma — contas/conteúdo do Daqui —
// e ii) contas da própria moderação (staff). "Todas" mora no primeiro grupo
// por convenção (era a primeira opção da lista única, antes da separação).
export const AUDIT_ACTION_FILTERS_PLATFORM = [
  { key: '', label: 'Todas' },
  { key: 'review_delete', label: 'Exclusão de avaliação' },
  { key: 'report_resolve', label: 'Denúncia resolvida' },
  { key: 'report_dismiss', label: 'Denúncia descartada' },
  { key: 'report_delete', label: 'Exclusão de denúncia' },
  { key: 'post_delete', label: 'Exclusão de post' },
  { key: 'comment_delete', label: 'Exclusão de comentário' },
  { key: 'user_suspend', label: 'Suspensão de conta' },
  { key: 'user_unsuspend', label: 'Reativação de conta' },
  { key: 'user_delete', label: 'Exclusão de conta' },
  { key: 'ticket_reply', label: 'Resposta de chamado' },
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

// Verbo usado na frase-resumo de cada ação, com e sem usuário afetado
// (algumas denúncias antigas podem não ter um usuário associado).
export const AUDIT_ACTION_VERB: Record<string, string> = {
  review_delete: 'excluiu a avaliação de',
  report_resolve: 'marcou como resolvida uma denúncia sobre',
  report_dismiss: 'descartou uma denúncia sobre',
  report_delete: 'excluiu uma denúncia sobre',
  post_delete: 'excluiu um post de',
  comment_delete: 'excluiu um comentário de',
  user_suspend: 'suspendeu a conta de',
  user_unsuspend: 'reativou a conta de',
  user_delete: 'excluiu a conta de',
  ticket_reply: 'respondeu um chamado de',
  // Alvo é a própria conta recém-criada (quem ativa o convite é quem o
  // aceita) — o texto evita "ativou o convite de @fulano" repetindo @fulano.
  staff_invite_accepted: 'ativou o convite e criou a própria conta de staff:',
  staff_username_change: 'alterou o nome de usuário de',
  staff_suspend: 'suspendeu a conta de staff de',
  staff_unsuspend: 'reativou a conta de staff de',
  staff_delete: 'excluiu a conta de staff de',
};

export const AUDIT_ACTION_VERB_NO_TARGET: Record<string, string> = {
  review_delete: 'excluiu uma avaliação',
  report_resolve: 'marcou uma denúncia como resolvida',
  report_dismiss: 'descartou uma denúncia',
  report_delete: 'excluiu uma denúncia',
  post_delete: 'excluiu um post',
  comment_delete: 'excluiu um comentário',
  user_suspend: 'suspendeu uma conta',
  user_unsuspend: 'reativou uma conta',
  user_delete: 'excluiu uma conta',
  ticket_reply: 'respondeu um chamado',
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

export function statusTone(status: string): 'green' | 'amber' | 'red' | 'neutral' {
  if (status === 'pending') return 'amber';
  if (status === 'reviewed' || status === 'answered' || status === 'approved') return 'green';
  if (status === 'dismissed' || status === 'rejected') return 'red';
  return 'neutral';
}
