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


def search(db: Session, user_id: int, query: str, limit: int = 30) -> list[Message]:
    # Mensagens (enviadas ou recebidas pelo usuário) cujo conteúdo casa com a busca.
    like = f"%{query}%"
    return (
        db.query(Message)
        .filter(
            or_(Message.sender_id == user_id, Message.receiver_id == user_id),
            Message.content.ilike(like),
        )
        .order_by(desc(Message.created_at))
        .limit(limit)
        .all()
    )


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


def count_unread_total(db: Session, user_id: int) -> int:
    return (
        db.query(func.count(Message.id))
        .filter(Message.receiver_id == user_id, Message.read.is_(False))
        .scalar()
        or 0
    )


def new_received_since(db: Session, user_id: int, since) -> list[Message]:
    return (
        db.query(Message)
        .filter(Message.receiver_id == user_id, Message.created_at > since)
        .order_by(Message.id)
        .all()
    )


def get_by_id(db: Session, message_id: int) -> Message | None:
    return db.query(Message).filter(Message.id == message_id).first()


def create(
    db: Session,
    sender_id: int,
    receiver_id: int,
    content: str,
    shared_post_id: int | None = None,
    reply_to_id: int | None = None,
    shared_comment_id: int | None = None,
) -> Message:
    msg = Message(
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content,
        shared_post_id=shared_post_id,
        shared_comment_id=shared_comment_id,
        reply_to_id=reply_to_id,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
