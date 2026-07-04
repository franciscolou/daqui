from sqlalchemy.orm import Session

from app.daos import notification
from app.models.notification import Notification
from app.models.user import User


def list_for_user(db: Session, user: User) -> list[Notification]:
    return notification.list_for_user(db, user.id)


def mark_all_read(db: Session, user: User) -> None:
    notification.mark_all_read(db, user.id)


def unread_count(db: Session, user: User) -> int:
    return notification.count_unread(db, user.id)
