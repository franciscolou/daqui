import { AppState, AppStateStatus, Platform } from 'react-native';
import { ANALYTICS_FLUSH_INTERVAL_MS } from '../constants/config';
import { api, AnalyticsEventPayload } from './api';

/**
 * Tracker de uso do app (telas/tempo de permanência, cliques em ações-chave,
 * buscas) — alimenta a aba Analytics (Owner-only) do moderator. Só ativo
 * enquanto autenticado: ligado/desligado por lib/auth.tsx (mesmo padrão de
 * lib/push.ts, ver enableAnalytics/disableAnalytics abaixo).
 */

function randomUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Uma sessão por abertura do app — de propósito não persiste entre
// reinicializações (diferente do adViewerId de lib/storage.ts).
const sessionId = randomUuidV4();
const platform = Platform.OS;

let enabled = false;
let queue: AnalyticsEventPayload[] = [];
let currentScreen: string | null = null;
let enteredAt: number | null = null;
let cleanupListeners: (() => void) | null = null;

function enqueue(event: Omit<AnalyticsEventPayload, 'sessionId' | 'platform'>): void {
  if (!enabled) return;
  queue.push({ ...event, sessionId, platform });
}

function closeCurrentScreen(isExit: boolean): void {
  if (!currentScreen || enteredAt == null) return;
  enqueue({
    eventType: 'screen_view',
    screen: currentScreen,
    durationMs: Date.now() - enteredAt,
    isExit,
  });
}

/** Chamado a cada troca de rota (ver app/_layout.tsx) — fecha a tela
 * anterior com a duração da visita e abre a nova. */
export function trackScreenView(screen: string): void {
  if (!enabled || screen === currentScreen) return;
  closeCurrentScreen(false);
  currentScreen = screen;
  enteredAt = Date.now();
}

/** Ação de alto valor (curtir, publicar, trocar de tab...) — usa a tela
 * corrente automaticamente, call sites só passam o rótulo da ação. */
export function trackClick(label: string): void {
  enqueue({ eventType: 'click', screen: currentScreen ?? undefined, label });
}

export function trackSearch(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  enqueue({ eventType: 'search', screen: currentScreen ?? undefined, query: trimmed });
}

function flush(): void {
  if (queue.length === 0) return;
  const events = queue;
  queue = [];
  api.trackEvents(events);
}

/** App indo pra background/fechando — heurística padrão de analytics
 * mobile pra "sessão encerrada" (ver limitação conhecida no CLAUDE.md). */
function trackAppBackground(): void {
  closeCurrentScreen(true);
  currentScreen = null;
  enteredAt = null;
  flush();
}

/** Liga o tracking — chamado quando uma sessão fica ativa (login, 2FA,
 * restauração no boot), ver lib/auth.tsx. Idempotente. */
export function enableAnalytics(): void {
  if (enabled) return;
  enabled = true;

  const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'background' || state === 'inactive') trackAppBackground();
  });
  const interval = setInterval(flush, ANALYTICS_FLUSH_INTERVAL_MS);

  let removeWebListeners: (() => void) | undefined;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const onHide = () => {
      if (document.visibilityState === 'hidden') trackAppBackground();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onHide);
    removeWebListeners = () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onHide);
    };
  }

  cleanupListeners = () => {
    sub.remove();
    clearInterval(interval);
    removeWebListeners?.();
  };
}

/** Desliga o tracking (logout) — fecha e envia a tela corrente antes de
 * descartar o estado da sessão. */
export function disableAnalytics(): void {
  if (!enabled) return;
  trackAppBackground();
  enabled = false;
  cleanupListeners?.();
  cleanupListeners = null;
}

// ── Normalização de rota ──────────────────────────────────────────────
// Tabela estática espelhando os <Stack.Screen name="..."> de app/_layout.tsx
// (grupos (auth)/(tabs) não aparecem na URL) — evita explodir a cardinalidade
// dos relatórios com ids/usernames reais de cada visita.
const ROUTE_PATTERNS: [RegExp, string][] = [
  [/^\/$/, '(tabs)/index'],
  [/^\/search$/, '(tabs)/search'],
  [/^\/publish$/, '(tabs)/publish'],
  [/^\/notifications$/, '(tabs)/notifications'],
  [/^\/messages$/, '(tabs)/messages'],
  [/^\/map$/, '(tabs)/map'],
  [/^\/profile$/, '(tabs)/profile'],
  [/^\/user\/[^/]+$/, 'user/[username]'],
  [/^\/[^/]+\/post\/[^/]+$/, '[username]/post/[publicId]'],
  [/^\/ad\/[^/]+$/, 'ad/[id]'],
  [/^\/poll\/[^/]+$/, 'poll/[id]'],
  [/^\/messages\/[^/]+\/info$/, 'messages/[username]/info'],
  [/^\/messages\/[^/]+\/media$/, 'messages/[username]/media'],
  [/^\/messages\/[^/]+$/, 'messages/[username]/index'],
  [/^\/groups\/new$/, 'groups/new'],
  [/^\/groups\/[^/]+\/info$/, 'groups/[publicId]/info'],
  [/^\/groups\/[^/]+\/media$/, 'groups/[publicId]/media'],
  [/^\/groups\/[^/]+$/, 'groups/[publicId]/index'],
  [/^\/groups$/, 'groups/index'],
  [/^\/neighbors$/, 'neighbors/index'],
  [/^\/rate$/, 'rate/index'],
  [/^\/help$/, 'help/index'],
  [/^\/forward\/[^/]+$/, 'forward/[postId]'],
  [/^\/quote\/[^/]+$/, 'quote/[postId]'],
  [/^\/advertise\/customize$/, 'advertise/customize'],
  [/^\/advertise\/checkout\/success$/, 'advertise/checkout/success'],
  [/^\/advertise\/checkout$/, 'advertise/checkout'],
  [/^\/advertise\/dashboard\/edit\/[^/]+$/, 'advertise/dashboard/edit/[token]'],
  [/^\/advertise\/dashboard\/[^/]+$/, 'advertise/dashboard/[token]'],
  [/^\/advertise\/dashboard$/, 'advertise/dashboard/index'],
  [/^\/advertise$/, 'advertise/index'],
  [/^\/settings$/, 'settings'],
  [/^\/legal\/terms$/, 'legal/terms'],
  [/^\/legal\/privacy$/, 'legal/privacy'],
];

export function normalizeScreen(pathname: string): string {
  const clean = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  for (const [pattern, label] of ROUTE_PATTERNS) {
    if (pattern.test(clean)) return label;
  }
  return clean;
}
