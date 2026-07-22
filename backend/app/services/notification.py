from sqlalchemy.orm import Session

from app.core import realtime_registry
from app.daos import notification
from app.models.notification import MODERATION_NOTICE_TYPES, Notification
from app.models.user import User
from app.services import push as push_service


def notify(
    db: Session,
    *,
    user_id: int,
    type_: str,
    content: str,
    push_title: str,
    push_body: str,
    actor_id: int | None = None,
    target_text: str | None = None,
    post_id: int | None = None,
    snapshot: dict | None = None,
) -> Notification:
    """Cria a `Notification`, acorda o websocket do usuário e dispara o push
    — os 3 passos que toda notificação real do backend precisa (menção,
    avisos de moderação). Ponto único pra não duplicar essa sequência em
    cada service que cria uma notificação."""
    notif = notification.create(
        db,
        user_id=user_id,
        type_=type_,
        content=content,
        target_text=target_text,
        post_id=post_id,
        actor_id=actor_id,
        snapshot=snapshot,
    )
    realtime_registry.wake(user_id)
    push_service.notify_user(db, user_id, push_title, push_body)
    return notif


def list_for_user(db: Session, user: User) -> list[Notification]:
    return notification.list_for_user(db, user.id)


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
