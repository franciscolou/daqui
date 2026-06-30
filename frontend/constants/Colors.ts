export const Colors = {
  primary: '#22C55E',
  primaryDark: '#16A34A',
  primaryDeep: '#15803D',
  primaryLight: '#DCFCE7',
  primaryFaint: '#F0FDF4',

  accent: '#F97316',
  accentLight: '#FFF7ED',

  indigo: '#6366F1',
  indigoLight: '#EEF2FF',

  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',

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
  },

  shadow: {
    sm: { boxShadow: '0px 1px 4px rgba(0,0,0,0.06)' },
    md: { boxShadow: '0px 4px 12px rgba(0,0,0,0.08)' },
    lg: { boxShadow: '0px 8px 24px rgba(0,0,0,0.12)' },
  },
};
