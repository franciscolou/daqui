import { Text, StyleProp, TextStyle } from 'react-native';
import { TFunction } from 'i18next';
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
 *  - Seu post/comentário foi removido/restaurado pela moderação... (post_removed/
 *    comment_removed/post_restored/comment_restored, texto fixo por i18n, ignora
 *    n.content — mesmo padrão do welcome)
 * Curtida de post com mais de 3 curtidores mescla numa só notificação
 * (n.groupCount/n.extraActor, ver services/post.py::_notify_like no backend):
 *  - [Usuário1], [Usuário2] e outra(s) X pessoa(s) curtiram seu post
 */
export function notificationParts(n: AppNotification, boldStyle: StyleProp<TextStyle>, t: TFunction) {
  const actor = <Text style={boldStyle}>{n.actor?.name ?? t('notifications.someone')}</Text>;
  const target = <Text style={boldStyle}>{truncate(n.targetText ?? '')}</Text>;

  switch (n.type) {
    case 'like_post': {
      if (n.groupCount && n.groupCount > 1) {
        const others = n.groupCount - (n.extraActor ? 2 : 1);
        const othersText = others === 1
          ? t('notifications.onePerson')
          : t('notifications.morePeople', { count: others });
        return n.extraActor ? (
          <>{actor}, <Text style={boldStyle}>{n.extraActor.name}</Text>{t('notifications.and')}{othersText}{t('notifications.likedYourPostGroupSuffix')}</>
        ) : (
          <>{actor}{t('notifications.and')}{othersText}{t('notifications.likedYourPostGroupSuffix')}</>
        );
      }
      return <>{actor}{t('notifications.likedYourPost')}{QUOTE}{target}{QUOTE}</>;
    }
    case 'like_comment':
      return <>{actor}{t('notifications.likedYourComment')}{QUOTE}{target}{QUOTE}</>;
    case 'comment':
      return <>{actor}{t('notifications.commented')}{QUOTE}{target}{QUOTE}</>;
    case 'mention':
      return <>{actor}{t('notifications.mentionedYou')}{QUOTE}{target}{QUOTE}</>;
    case 'follow':
      return <>{actor}{t('notifications.startedFollowing')}</>;
    case 'welcome':
      return <>{t('notifications.welcomeBefore')}<Text style={boldStyle}>{t('notifications.welcomeHighlight')}</Text>{t('notifications.welcomeAfter')}</>;
    case 'post_removed':
      return <>{t('notifications.postRemovedText')}</>;
    case 'comment_removed':
      return <>{t('notifications.commentRemovedText')}</>;
    case 'post_restored':
      return <>{t('notifications.postRestoredText')}</>;
    case 'comment_restored':
      return <>{t('notifications.commentRestoredText')}</>;
    default:
      return <>{n.content}</>;
  }
}
