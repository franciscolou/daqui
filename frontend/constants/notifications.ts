import { Colors } from './Colors';

// Ícone + cores por tipo de notificação (novidade).
export const NOTIF_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  like_post: { icon: 'heart', bg: '#FEE2E2', color: Colors.error },
  like_comment: { icon: 'heart', bg: '#FEE2E2', color: Colors.error },
  comment: { icon: 'chatbubble', bg: Colors.indigoLight, color: Colors.indigo },
  mention: { icon: 'at', bg: Colors.primaryFaint, color: Colors.primary },
  follow: { icon: 'person-add', bg: Colors.primaryFaint, color: Colors.primary },
  post_removed: { icon: 'trash-outline', bg: '#FEE2E2', color: Colors.error },
  comment_removed: { icon: 'trash-outline', bg: '#FEE2E2', color: Colors.error },
  // Fallback para tipos antigos/desconhecidos
  welcome: { icon: 'sparkles', bg: Colors.accentLight, color: Colors.accent },
  ad: { icon: 'megaphone', bg: Colors.accentLight, color: Colors.accent },
};
