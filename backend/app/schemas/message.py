from datetime import datetime

from pydantic import BaseModel, Field

from app.core.uploads import MediaType
from app.models.mute import MuteKind
from app.models.notification import NotificationType
from app.models.post import PostCategory
from app.schemas.attachment import AttachmentItem
from app.schemas.user import UserPublic


class SharedPostOut(BaseModel):
    """Prévia compacta de um post encaminhado em uma mensagem."""

    id: int
    # Identificador de URL (estilo Twitter, opaco) — ver models/post.py::public_id.
    public_id: str
    category: PostCategory
    title: str | None
    content: str
    image_urls: list[str] = []
    created_at: datetime
    author: UserPublic

    model_config = {"from_attributes": True}


class SharedCommentOut(BaseModel):
    """Prévia compacta de um comentário encaminhado em uma mensagem."""

    id: int
    post_id: int
    # Post pai, pra montar o link `/post/{username}/status/{public_id}` da
    # prévia sem expor `post_id` (ver models/comment.py). None no raro caso
    # de post pai ausente.
    post_public_id: str | None = None
    post_author_username: str | None = None
    content: str
    created_at: datetime
    author: UserPublic

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    receiver_id: int
    content: str = ""
    # Foto ou vídeo anexado (opcional; ver services/message.py::upload_media).
    # Mensagem pode ser só mídia, sem texto.
    media_url: str | None = None
    media_type: MediaType | None = None
    media: list[AttachmentItem] = Field(default_factory=list, max_length=10)
    shared_post_id: int | None = None
    shared_comment_id: int | None = None
    reply_to_id: int | None = None
    # Id de AdCampaign no ads-backend (opaco, sem validação — ver
    # models/message.py::shared_ad_id).
    shared_ad_id: int | None = None


class TypingPing(BaseModel):
    target_type: MuteKind
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
    media_url: str | None = None
    media_type: MediaType | None = None
    media: list[AttachmentItem] | None = None
    read: bool
    created_at: datetime
    sender: UserPublic
    shared_post: SharedPostOut | None = None
    shared_comment: SharedCommentOut | None = None
    shared_ad_id: int | None = None
    reply_to: MessageReplyOut | None = None

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    user: UserPublic
    last_message: str
    last_message_at: datetime
    unread_count: int
    is_muted: bool = False
    muted_until: datetime | None = None


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
    type: NotificationType
    content: str
    read: bool
    post_id: int | None
    created_at: datetime
    actor: "UserPublic | None"

    model_config = {"from_attributes": True}
