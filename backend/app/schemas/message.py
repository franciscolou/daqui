from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserPublic


class SharedPostOut(BaseModel):
    """Prévia compacta de um post encaminhado em uma mensagem."""

    id: int
    category: str
    title: str | None
    content: str
    image_url: str | None
    created_at: datetime
    author: UserPublic

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    receiver_id: int
    content: str = ""
    shared_post_id: int | None = None


class MessageOut(BaseModel):
    id: int
    content: str
    read: bool
    created_at: datetime
    sender: UserPublic
    shared_post: SharedPostOut | None = None

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    user: UserPublic
    last_message: str
    last_message_at: datetime
    unread_count: int


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
