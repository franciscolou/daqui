from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.notification import Notification


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
