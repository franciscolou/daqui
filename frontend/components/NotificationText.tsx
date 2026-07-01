import { Text, StyleProp, TextStyle } from 'react-native';
import { AppNotification } from '../lib/api';

const QUOTE = '"';

function truncate(value: string, max = 70): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/**
 * Texto padronizado da notificação. As variáveis (nome do autor e trecho do
 * post/comentário) ficam em negrito; o restante é fixo por tipo:
 *  - [Usuário] curtiu seu post: "[Texto do post]"
 *  - [Usuário] curtiu seu comentário "[Texto do comentário]"
 *  - [Usuário] começou a seguir você
 *  - [Usuário] comentou: "[Texto do comentário]"
 */
export function notificationParts(n: AppNotification, boldStyle: StyleProp<TextStyle>) {
  const actor = <Text style={boldStyle}>{n.actor?.name ?? 'Alguém'}</Text>;
  const target = <Text style={boldStyle}>{truncate(n.targetText ?? '')}</Text>;

  switch (n.type) {
    case 'like_post':
      return <>{actor} curtiu seu post: {QUOTE}{target}{QUOTE}</>;
    case 'like_comment':
      return <>{actor} curtiu seu comentário {QUOTE}{target}{QUOTE}</>;
    case 'comment':
      return <>{actor} comentou: {QUOTE}{target}{QUOTE}</>;
    case 'follow':
      return <>{actor} começou a seguir você</>;
    default:
      return <>{n.content}</>;
  }
}
