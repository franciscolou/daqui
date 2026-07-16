// Compacta números grandes pra rótulo (1234 -> "1,2 mil"), mesmo padrão dos
// stat tiles do resto do app.
export function formatCompactNumber(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs < 1000) return sign + abs.toLocaleString('pt-BR');
  if (abs < 1_000_000) return sign + (abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
  return sign + (abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
}

// Teto "redondo" pra escala de eixo (137 -> 200, 1340 -> 1500, 3 -> 4).
export function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const norm = value / base;
  let niceNorm: number;
  if (norm <= 1) niceNorm = 1;
  else if (norm <= 2) niceNorm = 2;
  else if (norm <= 5) niceNorm = 5;
  else niceNorm = 10;
  return niceNorm * base;
}

export function niceTicks(max: number, count = 3): number[] {
  const top = niceCeil(Math.max(1, max));
  const step = top / count;
  return Array.from({ length: count + 1 }, (_, i) => Math.round(step * i));
}

// Escolhe até `max` índices igualmente espaçados (sempre incluindo o primeiro
// e o último) — usado pros rótulos do eixo X, pra não poluir com uma marca
// por dia num período de 90 dias.
export function pickLabelIndices(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (max - 1);
  const out: number[] = [];
  for (let i = 0; i < max; i++) out.push(Math.round(i * step));
  return Array.from(new Set(out));
}
