from datetime import datetime

from pydantic import BaseModel

from app.core.uploads import MediaType


class AttachmentItem(BaseModel):
    url: str
    type: MediaType


class MediaGalleryItem(BaseModel):
    """Item da galeria de mídia compartilhada numa conversa (DM ou grupo) —
    ver services/message.py::list_media e services/group.py::list_media."""

    id: int
    url: str
    type: MediaType
    created_at: datetime
