from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.notification import Notification


def create(
    db: Session,
    user_id: int,
    type_: str,
    content: str,
    target_text: str | None = None,
    post_id: int | None = None,
    actor_id: int | None = None,
    snapshot: dict | None = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        actor_id=actor_id,
        type=type_,
        content=content,
        target_text=target_text,
        post_id=post_id,
        snapshot=snapshot,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def list_unread_by_types(db: Session, user_id: int, types: tuple[str, ...]) -> list[Notification]:
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
