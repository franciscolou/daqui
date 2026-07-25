from sqlalchemy.orm import Session

from app.core import realtime_registry
from app.daos import notification
from app.models.notification import (
    MODERATION_NOTICE_TYPES,
    Notification,
    NotificationType,
)
from app.models.user import User
from app.services import push as push_service

# Tipos cobertos por uma preferência do destinatário (Configurações > Notificações
# > No aplicativo). Menções e avisos de moderação não entram aqui — sempre notificam.
_PREFERENCE_BY_TYPE: dict[NotificationType, str] = {
    NotificationType.LIKE_POST: "notify_likes",
    NotificationType.LIKE_COMMENT: "notify_likes",
    NotificationType.COMMENT: "notify_comments",
    NotificationType.NEIGHBORHOOD_ALERT: "notify_neighborhood_alerts",
}


def notify(
    db: Session,
    *,
    user_id: int,
    type_: NotificationType,
    content: str,
    push_title: str,
    push_body: str,
    actor_id: int | None = None,
    target_text: str | None = None,
    post_id: int | None = None,
    snapshot: dict | None = None,
    extra_actor_id: int | None = None,
    group_count: int | None = None,
) -> Notification | None:
    """Cria a `Notification`, acorda o websocket do usuário e dispara o push
    — os 3 passos que toda notificação real do backend precisa (menção,
    avisos de moderação, curtida, comentário, aviso do bairro). Ponto único
    pra não duplicar essa sequência em cada service que cria uma notificação.
    Retorna None (sem criar nada) se o destinatário desativou a preferência
    correspondente a este tipo."""
    pref_attr = _PREFERENCE_BY_TYPE.get(type_)
    if pref_attr:
        recipient = db.get(User, user_id)
        if recipient and not getattr(recipient, pref_attr):
            return None
    notif = notification.create(
        db,
        user_id=user_id,
        type_=type_,
        content=content,
        target_text=target_text,
        post_id=post_id,
        actor_id=actor_id,
        snapshot=snapshot,
        extra_actor_id=extra_actor_id,
        group_count=group_count,
    )
    realtime_registry.wake(user_id)
    push_service.notify_user(db, user_id, push_title, push_body)
    return notif


def list_for_user(db: Session, user: User) -> list[Notification]:
    return notification.list_for_user(db, user.id)


def list_like_notifications(db: Session, user_id: int, post_id: int) -> list[Notification]:
    return notification.list_like_notifications_for_post(db, user_id, post_id)


def delete_notification(db: Session, notif: Notification) -> None:
    notification.delete(db, notif)


def mark_all_read(db: Session, user: User) -> None:
    notification.mark_all_read(db, user.id)


def unread_count(db: Session, user: User) -> int:
    return notification.count_unread(db, user.id)


def consume_moderation_notice(db: Session, user: User) -> str | None:
    """Retorna (e marca como lido) o aviso de moderação pendente do usuário, se houver.

    Chamado em /auth/me — é assim que o usuário "recebe uma mensagem na
    próxima vez que entrar no app" quando um post/comentário seu foi removido.
    """
    pending = notification.list_unread_by_types(db, user.id, MODERATION_NOTICE_TYPES)
    if not pending:
        return None
    notification.mark_read_ids(db, [n.id for n in pending])
    if len(pending) == 1:
        return pending[0].content
    return f"Você tem {len(pending)} avisos da moderação. Veja a aba de novidades para mais detalhes."
