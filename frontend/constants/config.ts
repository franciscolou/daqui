// Parâmetros de comportamento do app (limites, TTLs, debounces, thresholds)
// centralizados aqui — equivalente do `core/config.py` do backend/ads-backend
// (ver CLAUDE.md). Cores/tokens de UI continuam em `constants/Colors.ts`.

import type { PostCategory } from '../data/mock';

// ── Layout responsivo ────────────────────────────────────────────────
// Largura mínima (px) a partir da qual o app troca pro layout desktop
// (sidebars fixas, sem tab bar) — ver WideLayout.tsx e uso em cada tela.
export const DESKTOP_BREAKPOINT = 900;

// ── Busca / autocomplete ─────────────────────────────────────────────
export const SEARCH_DEBOUNCE_MS = 300;
// Mínimo de caracteres antes do autocomplete de endereço disparar (ver
// LocationAutocompleteInput.tsx).
export const MIN_QUERY_LENGTH = 3;
// Debounce da checagem de disponibilidade de username/e-mail (ver
// lib/useAvailability.ts).
export const AVAILABILITY_DEBOUNCE_MS = 450;

// ── Anúncios: espaçamento/rotação em listas (ver lib/adSpacing.ts) ────
export interface AdGapConfig {
  minGap: number;
  maxGap: number;
}
// Feed e notificações: pelo menos 5 itens orgânicos entre anúncios.
export const FEED_AD_GAP: AdGapConfig = { minGap: 5, maxGap: 12 };
// Mensagens: intervalo mínimo maior — inbox costuma ser bem mais curto que o
// feed, então pede mais espaço antes de abrir a próxima oportunidade.
export const MESSAGES_AD_GAP: AdGapConfig = { minGap: 7, maxGap: 14 };

// Mesmo threshold usado pela indústria de ads (padrão MRC/IAB de "viewable
// impression"): pelo menos 50% do item visível por pelo menos 1s contínuo
// (ver lib/useAdImpression.ts).
export const AD_VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50, minimumViewTime: 1000 };

// ── Realtime (ver lib/realtime.tsx) ──────────────────────────────────
export const RECONNECT_DELAY_MS = 3000;

// ── Feed ──────────────────────────────────────────────────────────────
export const FEED_PAGE_SIZE = 20;

// Vida útil (em dias) do pin de cada categoria no mapa: passado esse prazo o
// pin já encolheu quase ao máximo (ver map.tsx e o decaimento em
// leafletHtml.ts). Categorias fora daqui — como "evento", que já tem vida
// própria marcada pelas `event_dates` — ficam sempre no tamanho normal.
export const CATEGORY_LIFESPAN_DAYS: Partial<Record<PostCategory, number>> = {
  recomendacao: 30,
  venda: 60,
  perdidos: 15,
  seguranca: 15,
};
// Nunca encolhe abaixo de 45% do tamanho normal — perto disso o pin vira
// um pontinho difícil de ver/tocar, então a "quase expiração" já basta
// pra sinalizar (não precisa chegar a quase sumir).
export const MIN_PIN_SCALE = 0.45;
// Acima desse número de pins colididos, o cluster vira símbolo de pilha em
// vez de leque (ver leafletHtml.ts).
export const STACK_THRESHOLD = 6;

// ── Avaliação do app (ver lib/useRateForm.ts) ────────────────────────
export const RATE_COMMENT_MAX_LENGTH = 1000;

// ── Denúncias (ver components/ReportModal.tsx) ───────────────────────
// Diferente de RATE_COMMENT_MAX_LENGTH acima — regra própria, não é a mesma.
export const REPORT_COMMENT_MAX_LENGTH = 3000;

// ── Enquetes (ver components/PollEditor.tsx) ─────────────────────────
export const MAX_POLL_OPTIONS = 10;

// ── Publicação (ver app/(tabs)/publish.tsx) ──────────────────────────
export const MAX_POST_MEDIA = 10;

// ── Comentários (ver app/post/[id].tsx) ──────────────────────────────
// Além dessa profundidade, não indenta mais (evita "escada" infinita).
export const MAX_COMMENT_INDENT_DEPTH = 4;

// ── Ajuda / chamados de suporte (ver app/help/index.tsx) ─────────────
export const MAX_TICKET_SUBJECT = 120;
export const MAX_TICKET_MESSAGE = 2000;

// ── Visualizador de mídia (ver components/ImageViewerModal.tsx) ──────
// Distância (px) de swipe pra trocar/fechar a mídia em tela cheia.
export const IMAGE_VIEWER_SWIPE_THRESHOLD = 50;

// ── Onboarding (ver app/(auth)/welcome.tsx) ──────────────────────────
// Abaixo desse total de contas, expor o número exato faria a rede parecer
// vazia — troca por uma mensagem de "comunidade em formação".
export const ESTABLISHED_COMMUNITY_THRESHOLD = 500;

// ── Chat (ver components/ChatView.tsx) ───────────────────────────────
export const CHAT_INPUT_MIN_HEIGHT = 40;
export const CHAT_INPUT_LINE_HEIGHT = 18;
// 10 linhas de texto + padding vertical do input (10 em cima, 10 embaixo)
export const CHAT_INPUT_MAX_HEIGHT = CHAT_INPUT_LINE_HEIGHT * 10 + 20;
// Janela (ms) pra um segundo toque contar como duplo-toque-pra-reagir.
export const CHAT_DOUBLE_TAP_MS = 400;

// ── Anúncios: configurador de duração/desconto (ver
// app/advertise/customize.tsx) — espelham constantes homônimas em
// `ads-backend/app/core/config.py` (ver services/ad_pricing.py); mantidas
// em sincronia manualmente, não importadas (serviços/linguagens separados).
export const AD_COMBO_DISCOUNT_PCT = 15;
export const AD_DURATION_PRESETS = [7, 15, 30, 90];
// Duração máxima de uma campanha: 720 dias (2 anos) — mesmo limite validado
// em `QuoteRequest`/`CampaignCreateBase` no ads-backend.
export const AD_MAX_DURATION_DAYS = 720;
// Escala não-linear do slider de duração: dá espaço proporcional pros
// presets mais comuns (7/15/30/90 dias) em vez de espremê-los nos primeiros
// ~12% de uma escala linear até 720 dias. Cada ponto é [posição 0-1, dias].
export const AD_DURATION_SCALE: [number, number][] = [
  [0, 1],
  [0.22, 7],
  [0.42, 15],
  [0.62, 30],
  [0.82, 90],
  [1, AD_MAX_DURATION_DAYS],
];
// Pontos do gráfico de desconto (espelha `DURATION_DISCOUNT_ANCHORS` em
// `ads-backend/app/services/ad_pricing.py`) — só ilustrativo, não afeta o
// preço de verdade (esse sempre vem da cotação do backend).
export const AD_DISCOUNT_CHART_POINTS: { days: number; pct: number }[] = [
  { days: 1, pct: 0 },
  { days: 30, pct: 5 },
  { days: 90, pct: 15 },
  { days: 180, pct: 22 },
  { days: 365, pct: 30 },
  { days: 720, pct: 40 },
];
