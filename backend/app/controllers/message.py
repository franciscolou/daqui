from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.message import (
    ConversationOut,
    MessageCreate,
    MessageOut,
    MessageSearchOut,
    TypingPing,
    UnreadCountOut,
)
from app.schemas.mute import MuteIn, MuteStatusOut
from app.services import message
from app.services import mutes as mute_service


def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ConversationOut]:
    return message.list_conversations(db, current_user)


def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnreadCountOut:
    return UnreadCountOut(count=message.unread_count(db, current_user))


def search_messages(
    q: str = Query("", description="Termo de busca"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MessageSearchOut]:
    return message.search_messages(db, current_user, q)


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


def ping_typing(
    payload: TypingPing,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    message.ping_typing(db, current_user, payload)


def get_mute(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MuteStatusOut:
    return mute_service.get_dm_status(db, current_user, user_id)


def mute_conversation(
    user_id: int,
    payload: MuteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MuteStatusOut:
    return mute_service.mute_dm(db, current_user, user_id, payload.duration)


def unmute_conversation(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MuteStatusOut:
    return mute_service.unmute_dm(db, current_user, user_id)
