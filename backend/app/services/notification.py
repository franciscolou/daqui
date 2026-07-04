from sqlalchemy.orm import Session

from app.daos import notification
from app.models.notification import MODERATION_NOTICE_TYPES, Notification
from app.models.user import User


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
