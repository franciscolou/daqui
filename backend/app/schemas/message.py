from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserPublic


class MessageCreate(BaseModel):
    receiver_id: int
    content: str


class MessageOut(BaseModel):
    id: int
    content: str
    read: bool
    created_at: datetime
    sender: UserPublic

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    user: UserPublic
    last_message: str
    last_message_at: datetime
    unread_count: int


class NotificationOut(BaseModel):
    id: int
    type: str
    content: str
    read: bool
    post_id: int | None
    created_at: datetime
    actor: "UserPublic | None"

    model_config = {"from_attributes": True}
