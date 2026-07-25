from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType


def create(
    db: Session,
    user_id: int,
    type_: NotificationType,
    content: str,
    target_text: str | None = None,
    post_id: int | None = None,
    actor_id: int | None = None,
    snapshot: dict | None = None,
    extra_actor_id: int | None = None,
    group_count: int | None = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        actor_id=actor_id,
        type=type_,
        content=content,
        target_text=target_text,
        post_id=post_id,
        snapshot=snapshot,
        extra_actor_id=extra_actor_id,
        group_count=group_count,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def list_like_notifications_for_post(
    db: Session, user_id: int, post_id: int
) -> list[Notification]:
    """Notificações de curtida (mescladas ou não) já existentes pro dono do post
    — usado por `services.post` pra decidir se cria uma nova ou consolida numa
    mesclada. Mais recente primeiro."""
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.post_id == post_id,
            Notification.type == NotificationType.LIKE_POST,
        )
        .order_by(desc(Notification.created_at))
        .all()
    )


def delete(db: Session, notif: Notification) -> None:
    db.delete(notif)
    db.commit()


def list_unread_by_types(
    db: Session, user_id: int, types: tuple[NotificationType, ...]
) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.read.is_(False),
            Notification.type.in_(types),
        )
        .order_by(Notification.created_at)
        .all()
    )


def mark_read_ids(db: Session, ids: list[int]) -> None:
    if not ids:
        return
    db.query(Notification).filter(Notification.id.in_(ids)).update(
        {"read": True}, synchronize_session=False
    )
    db.commit()


def list_for_user(db: Session, user_id: int, limit: int = 50) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(desc(Notification.created_at))
        .limit(limit)
        .all()
    )


def mark_all_read(db: Session, user_id: int) -> None:
    db.query(Notification).filter(
        Notification.user_id == user_id, Notification.read.is_(False)
    ).update({"read": True})
    db.commit()


def count_unread(db: Session, user_id: int) -> int:
    return (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == user_id, Notification.read.is_(False))
        .scalar()
        or 0
    )


def new_since(db: Session, user_id: int, since) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.created_at > since)
        .order_by(Notification.id)
        .all()
    )
