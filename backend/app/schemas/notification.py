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
    # Post alvo, pra montar o link `/post/{username}/status/{public_id}` sem
    # expor `post_id` — None quando não há post (ou o post já foi apagado).
    post_public_id: str | None = None
    post_author_username: str | None = None
    # Cópia do post/comentário removido pela moderação (não existe mais no banco).
    snapshot: dict[str, Any] | None = None
    created_at: datetime
    actor: UserPublic | None
    # Preenchidos só na notificação mesclada de curtidas (ver Notification.group_count).
    extra_actor: UserPublic | None = None
    group_count: int | None = None

    model_config = {"from_attributes": True}


class UnreadCountOut(BaseModel):
    count: int
