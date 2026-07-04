from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.user import UserPublic


class NotificationOut(BaseModel):
    id: int
    type: str
    content: str
    target_text: str | None
    read: bool
    post_id: int | None
    # Cópia do post/comentário removido pela moderação (não existe mais no banco).
    snapshot: dict[str, Any] | None = None
    created_at: datetime
    actor: UserPublic | None

    model_config = {"from_attributes": True}


class UnreadCountOut(BaseModel):
    count: int
