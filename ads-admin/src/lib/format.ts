export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function fmtMoney(cents?: number | null): string {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

export function fmtPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseCsvNumbers(raw: string): number[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}

export function parseCsvStrings(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Máscara de CPF (Pessoa Física) ou CNPJ (Pessoa Jurídica) conforme o tipo
 * do anunciante, aplicada enquanto se digita.
 */
export function maskDocument(type: 'individual' | 'company', value: string): string {
  const d = (value || '').replace(/\D/g, '');
  if (type === 'individual') {
    return d
      .slice(0, 11)
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }
  return d
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}
