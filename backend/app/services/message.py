from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import message, user
from app.models.message import Message
from app.models.user import User
from app.schemas.message import ConversationOut, MessageCreate
from app.schemas.user import UserPublic


def list_conversations(db: Session, user: User) -> list[ConversationOut]:
    last_messages = message.get_last_per_conversation(db, user.id)
    result = []
    for msg in last_messages:
        other_id = msg.receiver_id if msg.sender_id == user.id else msg.sender_id
        other = user.get_by_id(db, other_id)
        if not other:
            continue
        unread = message.count_unread(db, from_user_id=other_id, to_user_id=user.id)
        result.append(
            ConversationOut(
                user=UserPublic.model_validate(other),
                last_message=msg.content,
                last_message_at=msg.created_at,
                unread_count=unread,
            )
        )
    return result


def get_thread(db: Session, user: User, other_id: int) -> list[Message]:
    messages = message.get_thread(db, user.id, other_id)
    message.mark_thread_read(db, messages, receiver_id=user.id)
    return messages


def send(db: Session, user: User, payload: MessageCreate) -> Message:
    if not user.get_by_id(db, payload.receiver_id):
        raise HTTPException(status_code=404, detail="Destinatário não encontrado")
    return message.create(db, user.id, payload.receiver_id, payload.content)
