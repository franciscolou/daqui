from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserPublic


class NotificationOut(BaseModel):
    id: int
    type: str
    content: str
    read: bool
    post_id: int | None
    created_at: datetime
    actor: UserPublic | None

    model_config = {"from_attributes": True}
