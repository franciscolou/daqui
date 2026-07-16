// Formatação de datas/horas do app (pt-BR).
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
  const date = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${date} às ${d.toLocaleTimeString('pt-BR', HHMM)}`;
}

const MONTHS_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Horário exato pro tooltip de hover das contagens compactas (`formatPostTime`).
 * Mesmo dia: "23:59". Dias anteriores: "29 Jan 2026, 23:59". */
export function formatHoverTime(iso: string): string {
  const d = parseDate(iso);
  const time = d.toLocaleTimeString('pt-BR', HHMM);
  if (calendarDaysAgo(d) <= 0) return time;
  return `${d.getDate()} ${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}, ${time}`;
}

/** Mensagens: "agora" (<1min) ou hora exata "12:43". */
export function formatMessageTime(iso: string): string {
  const d = parseDate(iso);
  if (secondsSince(d) < 60) return 'agora';
  return d.toLocaleTimeString('pt-BR', HHMM);
}

/** Divisor de dia dentro de uma conversa. */
export function formatDayDivider(iso: string): string {
  const d = parseDate(iso);
  const days = calendarDaysAgo(d);
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return capitalize(d.toLocaleDateString('pt-BR', { weekday: 'long' })); // "Quarta-feira"
  if (d.getFullYear() === new Date().getFullYear()) {
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }); // "qua., 1 de ago."
  }
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }); // "1 de ago. de 2025"
}

/** Horário na lista de conversas (estilo WhatsApp). */
export function formatConversationTime(iso: string): string {
  const d = parseDate(iso);
  if (secondsSince(d) < 60) return 'agora';
  const days = calendarDaysAgo(d);
  if (days <= 0) return d.toLocaleTimeString('pt-BR', HHMM);
  if (days === 1) return 'Ontem';
  if (days < 7) return capitalize(d.toLocaleDateString('pt-BR', { weekday: 'short' })); // "Qua."
  if (d.getFullYear() === new Date().getFullYear()) {
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }); // "1 de ago."
  }
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}
