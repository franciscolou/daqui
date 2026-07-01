import { Colors } from './Colors';

// Ícone + cores por tipo de notificação (novidade).
export const NOTIF_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  like_post: { icon: 'heart', bg: '#FEE2E2', color: Colors.error },
  like_comment: { icon: 'heart', bg: '#FEE2E2', color: Colors.error },
  comment: { icon: 'chatbubble', bg: Colors.indigoLight, color: Colors.indigo },
  follow: { icon: 'person-add', bg: Colors.primaryFaint, color: Colors.primary },
  // Fallback para tipos antigos/desconhecidos
  welcome: { icon: 'sparkles', bg: Colors.accentLight, color: Colors.accent },
};
