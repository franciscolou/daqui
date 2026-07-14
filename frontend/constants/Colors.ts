// Cores de marca — iguais nos dois temas
const brand = {
  primary: '#22C55E',
  primaryDark: '#16A34A',
  primaryDeep: '#15803D',

  accent: '#F97316',
  indigo: '#6366F1',

  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  gradient: {
    primary: ['#22C55E', '#16A34A'] as const,
    warm: ['#F97316', '#EF4444'] as const,
    cool: ['#6366F1', '#3B82F6'] as const,
    hero: ['#16A34A', '#22C55E', '#4ADE80'] as const,
    dark: ['#0F172A', '#1E293B'] as const,
  },

  category: {
    geral: '#6366F1',
    aviso: '#EF4444',
    seguranca: '#F97316',
    evento: '#8B5CF6',
    recomendacao: '#22C55E',
    venda: '#F59E0B',
    pets: '#EC4899',
    ajuda: '#3B82F6',
    perdidos: '#14B8A6',
    enquete: '#0EA5E9',
  },
};

export const lightColors = {
  ...brand,
  primaryLight: '#DCFCE7',
  primaryFaint: '#F0FDF4',
  accentLight: '#FFF7ED',
  indigoLight: '#EEF2FF',

  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Destaque de alerta/urgente (pastéis no claro, tingido no escuro)
  dangerSurface: '#FFF1F0',
  dangerSurfaceStrong: '#FFE4E1',
  dangerBorder: '#FECACA',
  dangerBorderStrong: '#FCA5A5',
  dangerIconBg: '#FEE2E2',
  dangerTitle: '#B91C1C',
  dangerBody: '#7F1D1D',

  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',

  shadow: {
    sm: { boxShadow: '0px 1px 4px rgba(0,0,0,0.06)' },
    md: { boxShadow: '0px 4px 12px rgba(0,0,0,0.08)' },
    lg: { boxShadow: '0px 8px 24px rgba(0,0,0,0.12)' },
  },
};

export const darkColors: typeof lightColors = {
  ...brand,
  primaryLight: 'rgba(34,197,94,0.30)',
  primaryFaint: 'rgba(34,197,94,0.14)',
  accentLight: 'rgba(249,115,22,0.16)',
  indigoLight: 'rgba(99,102,241,0.18)',

  background: '#0B1220',
  surface: '#111A2E',
  surfaceElevated: '#1B2740',
  border: '#243049',
  borderLight: '#1A2336',

  // Destaque de alerta/urgente adaptado ao escuro (vermelho tingido, legível)
  dangerSurface: 'rgba(239,68,68,0.12)',
  dangerSurfaceStrong: 'rgba(239,68,68,0.20)',
  dangerBorder: 'rgba(239,68,68,0.35)',
  dangerBorderStrong: 'rgba(239,68,68,0.55)',
  dangerIconBg: 'rgba(239,68,68,0.22)',
  dangerTitle: '#FCA5A5',
  dangerBody: '#FCA5A5',

  text: '#F1F5F9',
  textSecondary: '#9FB0C3',
  textTertiary: '#8697AD',
  textInverse: '#0B1220',

  shadow: {
    sm: { boxShadow: '0px 1px 4px rgba(0,0,0,0.40)' },
    md: { boxShadow: '0px 4px 12px rgba(0,0,0,0.50)' },
    lg: { boxShadow: '0px 8px 24px rgba(0,0,0,0.60)' },
  },
};

export type Palette = typeof lightColors;

// Compatibilidade: telas ainda não migradas usam o tema claro.
export const Colors = lightColors;
