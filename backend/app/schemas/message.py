from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.user import UserPublic


class SharedPostOut(BaseModel):
    """Prévia compacta de um post encaminhado em uma mensagem."""

    id: int
    category: str
    title: str | None
    content: str
    image_urls: list[str] = []
    created_at: datetime
    author: UserPublic

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    receiver_id: int
    content: str = ""
    shared_post_id: int | None = None
    reply_to_id: int | None = None


class TypingPing(BaseModel):
    target_type: Literal["dm", "group"]
    target_id: int


class MessageReplyOut(BaseModel):
    """Prévia compacta da mensagem respondida (marcada com duplo clique)."""

    id: int
    content: str
    sender: UserPublic

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: int
    content: str
    read: bool
    created_at: datetime
    sender: UserPublic
    shared_post: SharedPostOut | None = None
    reply_to: MessageReplyOut | None = None

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    user: UserPublic
    last_message: str
    last_message_at: datetime
    unread_count: int


class UnreadCountOut(BaseModel):
    count: int


class MessageSearchOut(BaseModel):
    id: int
    content: str
    created_at: datetime
    from_me: bool
    conversation_user: UserPublic  # o outro participante da conversa


class NotificationOut(BaseModel):
    id: int
    type: str
    content: str
    read: bool
    post_id: int | None
    created_at: datetime
    actor: "UserPublic | None"

    model_config = {"from_attributes": True}
