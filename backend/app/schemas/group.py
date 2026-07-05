from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.message import MessageReplyOut
from app.schemas.user import UserPublic


class GroupMemberOut(BaseModel):
    user: UserPublic
    role: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class GroupOut(BaseModel):
    id: int
    name: str
    description: str
    avatar_url: Optional[str]
    is_open: bool
    owner_id: int
    neighborhood: str
    members_count: int
    created_at: datetime
    # Papel do usuário logado no grupo (None se não for membro).
    my_role: Optional[str] = None

    model_config = {"from_attributes": True}


class GroupDetailOut(GroupOut):
    members: list[GroupMemberOut] = []


class GroupConversationOut(BaseModel):
    group: GroupOut
    last_message: str
    last_message_at: datetime
    unread_count: int


class GroupCreate(BaseModel):
    name: str
    description: str = ""
    is_open: bool = False
    avatar_url: Optional[str] = None
    member_ids: list[int] = []


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_open: Optional[bool] = None
    avatar_url: Optional[str] = None


class GroupMemberAdd(BaseModel):
    user_id: int


class GroupAvatarUpdate(BaseModel):
    image: str  # data URL base64: "data:image/png;base64,...."


class GroupMessageCreate(BaseModel):
    content: str = ""
    reply_to_id: int | None = None


class GroupMessageOut(BaseModel):
    id: int
    content: str
    created_at: datetime
    sender: UserPublic
    reply_to: MessageReplyOut | None = None

    model_config = {"from_attributes": True}
