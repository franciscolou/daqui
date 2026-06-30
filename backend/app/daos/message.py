from sqlalchemy import and_, desc, func, or_
from sqlalchemy.orm import Session

from app.models.message import Message


def get_last_per_conversation(db: Session, user_id: int) -> list[Message]:
    # Mais recente primeiro; mantém apenas a primeira mensagem vista por
    # interlocutor. Feito em Python para ser compatível com SQLite
    # (que não possui as funções greatest/least).
    rows = (
        db.query(Message)
        .filter(or_(Message.sender_id == user_id, Message.receiver_id == user_id))
        .order_by(desc(Message.id))
        .all()
    )
    seen: set[int] = set()
    result: list[Message] = []
    for msg in rows:
        other_id = msg.receiver_id if msg.sender_id == user_id else msg.sender_id
        if other_id in seen:
            continue
        seen.add(other_id)
        result.append(msg)
    return result


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
