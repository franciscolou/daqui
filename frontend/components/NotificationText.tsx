import { Text, StyleProp, TextStyle } from 'react-native';
import { AppNotification } from '../lib/api';

const QUOTE = '"';

// Texto fixo no app (não vem do backend) — assim, se o desenvolvedor mudar
// esse texto, quem já recebeu a notificação de boas-vindas também vê a
// versão nova, em vez de ficar preso ao `content` gravado no banco na hora
// do cadastro.
const WELCOME_BEFORE = 'Bem-vindo(a) ao Daqui! Antes de começar, confira a seção ';
const WELCOME_HIGHLIGHT = 'Ajuda e suporte';
const WELCOME_AFTER = ' pra aprender a usar o app.';

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
 * Curtida de post com mais de 3 curtidores mescla numa só notificação
 * (n.groupCount/n.extraActor, ver services/post.py::_notify_like no backend):
 *  - [Usuário1], [Usuário2] e outra(s) X pessoa(s) curtiram seu post
 */
export function notificationParts(n: AppNotification, boldStyle: StyleProp<TextStyle>) {
  const actor = <Text style={boldStyle}>{n.actor?.name ?? 'Alguém'}</Text>;
  const target = <Text style={boldStyle}>{truncate(n.targetText ?? '')}</Text>;

  switch (n.type) {
    case 'like_post': {
      if (n.groupCount && n.groupCount > 1) {
        const others = n.groupCount - (n.extraActor ? 2 : 1);
        const othersText = others === 1 ? 'outra pessoa' : `outras ${others} pessoas`;
        return n.extraActor ? (
          <>{actor}, <Text style={boldStyle}>{n.extraActor.name}</Text> e {othersText} curtiram seu post</>
        ) : (
          <>{actor} e {othersText} curtiram seu post</>
        );
      }
      return <>{actor} curtiu seu post: {QUOTE}{target}{QUOTE}</>;
    }
    case 'like_comment':
      return <>{actor} curtiu seu comentário {QUOTE}{target}{QUOTE}</>;
    case 'comment':
      return <>{actor} comentou: {QUOTE}{target}{QUOTE}</>;
    case 'mention':
      return <>{actor} mencionou você: {QUOTE}{target}{QUOTE}</>;
    case 'follow':
      return <>{actor} começou a seguir você</>;
    case 'welcome':
      return <>{WELCOME_BEFORE}<Text style={boldStyle}>{WELCOME_HIGHLIGHT}</Text>{WELCOME_AFTER}</>;
    default:
      return <>{n.content}</>;
  }
}
