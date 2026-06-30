from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models.message import Message


def get_last_per_conversation(db: Session, user_id: int) -> list[Message]:
    subq = (
        db.query(
            func.greatest(Message.sender_id, Message.receiver_id).label("user_a"),
            func.least(Message.sender_id, Message.receiver_id).label("user_b"),
            func.max(Message.id).label("last_id"),
        )
        .filter(or_(Message.sender_id == user_id, Message.receiver_id == user_id))
        .group_by("user_a", "user_b")
        .subquery()
    )
    return db.query(Message).join(subq, Message.id == subq.c.last_id).all()


def get_thread(db: Session, user_id: int, other_id: int) -> list[Message]:
    return (
        db.query(Message)
        .filter(
            or_(
                and_(Message.sender_id == user_id, Message.receiver_id == other_id),
                and_(Message.sender_id == other_id, Message.receiver_id == user_id),
            )
        )
        .order_by(Message.created_at)
        .all()
    )


def mark_thread_read(db: Session, messages: list[Message], receiver_id: int) -> None:
    for m in messages:
        if m.receiver_id == receiver_id and not m.read:
            m.read = True
    db.commit()


def count_unread(db: Session, from_user_id: int, to_user_id: int) -> int:
    return (
        db.query(func.count(Message.id))
        .filter(
            Message.sender_id == from_user_id,
            Message.receiver_id == to_user_id,
            Message.read.is_(False),
        )
        .scalar()
        or 0
    )


def create(
    db: Session, sender_id: int, receiver_id: int, content: str
) -> Message:
    msg = Message(sender_id=sender_id, receiver_id=receiver_id, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
