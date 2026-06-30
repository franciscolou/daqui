from sqlalchemy import desc
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
