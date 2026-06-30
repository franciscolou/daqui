from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.message import Message
from app.models.user import User
from app.schemas.message import ConversationOut, MessageCreate, MessageOut
from app.services import message


def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ConversationOut]:
    return message.list_conversations(db, current_user)


def get_thread(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MessageOut]:
    return message.get_thread(db, current_user, user_id)


def send_message(
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageOut:
    return message.send(db, current_user, payload)
