import i18next from 'i18next';

// Formatação de datas/horas do app no idioma ativo.
// Posts/comentários usam contagem compacta; mensagens usam hora exata + divisores de dia.

// Os timestamps do backend são UTC, mas podem chegar sem sufixo de fuso.
// Nesse caso assumimos UTC (senão o navegador os leria como horário local).
function parseDate(iso: string): Date {
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasTz ? iso : `${iso}Z`);
}

function secondsSince(d: Date): number {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Diferença em dias de calendário (0 = hoje, 1 = ontem, ...).
function calendarDaysAgo(d: Date): number {
  const diff = startOfDay(new Date()).getTime() - startOfDay(d).getTime();
  return Math.round(diff / 86_400_000);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const HHMM: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

function locale(): string {
  return i18next.language?.startsWith('en') ? 'en-US' : 'pt-BR';
}

export const activeLocale = locale;

function word(pt: string, en: string): string {
  return locale().startsWith('en') ? en : pt;
}

/** Posts e comentários: "40s", "40m", "10h", "2d". */
export function formatPostTime(iso: string): string {
  const s = secondsSince(parseDate(iso));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Horário exato mostrado no detalhe do post/comentário. Ex.: "1 de ago. de 2025 às 14:32". */
export function formatExactDateTime(iso: string): string {
  const d = parseDate(iso);
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

/** Data curta no idioma ativo, sem horário. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short', year: 'numeric' })
    .format(parseDate(iso));
}

/** Horário exato pro tooltip de hover das contagens compactas (`formatPostTime`).
 * Mesmo dia: "23:59". Dias anteriores: "29 Jan 2026, 23:59". */
export function formatHoverTime(iso: string): string {
  const d = parseDate(iso);
  const time = d.toLocaleTimeString(locale(), HHMM);
  if (calendarDaysAgo(d) <= 0) return time;
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

/** Mensagens: "agora" (<1min) ou hora exata "12:43". */
export function formatMessageTime(iso: string): string {
  const d = parseDate(iso);
  if (secondsSince(d) < 60) return word('agora', 'now');
  return d.toLocaleTimeString(locale(), HHMM);
}

/** Divisor de dia dentro de uma conversa. */
export function formatDayDivider(iso: string): string {
  const d = parseDate(iso);
  const days = calendarDaysAgo(d);
  if (days <= 0) return word('Hoje', 'Today');
  if (days === 1) return word('Ontem', 'Yesterday');
  if (days < 7) return capitalize(d.toLocaleDateString(locale(), { weekday: 'long' }));
  if (d.getFullYear() === new Date().getFullYear()) {
    return d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Horário na lista de conversas (estilo WhatsApp). */
export function formatConversationTime(iso: string): string {
  const d = parseDate(iso);
  if (secondsSince(d) < 60) return word('agora', 'now');
  const days = calendarDaysAgo(d);
  if (days <= 0) return d.toLocaleTimeString(locale(), HHMM);
  if (days === 1) return word('Ontem', 'Yesterday');
  if (days < 7) return capitalize(d.toLocaleDateString(locale(), { weekday: 'short' }));
  if (d.getFullYear() === new Date().getFullYear()) {
    return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
}
