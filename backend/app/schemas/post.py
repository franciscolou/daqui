from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.core.uploads import MediaType
from app.models.post import PostCategory
from app.schemas.message import SharedCommentOut, SharedPostOut
from app.schemas.user import UserPublic

MAX_MEDIA_ITEMS = 10


class PostMediaItem(BaseModel):
    url: str
    type: MediaType


class ImportantQuota(BaseModel):
    """Cota mensal de posts marcados como importantes (ver
    services/post.py::MAX_IMPORTANT_POSTS_PER_MONTH) — usada pra desabilitar o
    toggle "Marcar como importante" no app antes de o usuário tentar publicar."""

    used: int
    limit: int
    remaining: int
    resets_at: datetime  # início do próximo mês (UTC)


# ── Enquete ───────────────────────────────────────────────────────────
class PollCreate(BaseModel):
    options: list[str]
    multiple: bool = False
    closes_at: datetime


class PollOptionEdit(BaseModel):
    # id presente → opção existente (preserva votos); ausente → nova opção.
    id: Optional[int] = None
    text: str


class PollUpdate(BaseModel):
    options: list[PollOptionEdit]
    multiple: bool
    closes_at: datetime


class PollVoteIn(BaseModel):
    option_ids: list[int]


class PollOptionOut(BaseModel):
    id: int
    text: str
    votes_count: int


class PollOut(BaseModel):
    multiple: bool
    closes_at: datetime
    closed: bool
    total_votes: int
    options: list[PollOptionOut]
    my_votes: list[int]  # ids das opções em que o usuário votou


class PostCreate(BaseModel):
    category: PostCategory
    title: Optional[str] = None
    content: str
    # Já enviados via POST /posts/media (imagens e/ou vídeos), até 10 itens.
    media: list[PostMediaItem] = []
    details: Optional[dict] = None  # campos específicos da categoria
    important: bool = False
    # Coordenadas já resolvidas no cliente (autocomplete ou pin no mapa —
    # ambos já filtrados pro bairro do usuário lá na origem). Quando ausentes
    # (cliente antigo, ou local digitado sem escolher sugestão), o backend
    # geocodifica `details.location` do zero — ver services/post.py::create_post.
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    poll: Optional[PollCreate] = None
    # Repost com citação (estilo Twitter): no máximo um dos dois preenchido —
    # ver services/post.py::create_post.
    quoted_post_id: Optional[int] = None
    quoted_comment_id: Optional[int] = None


class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    poll: Optional[PollUpdate] = None


class PostOut(BaseModel):
    id: int
    category: PostCategory
    title: Optional[str]
    content: str
    media: list[PostMediaItem] = []
    image_urls: list[str] = []  # compat: só as imagens de `media`
    details: Optional[dict] = None
    neighborhood: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    likes_count: int
    comments_count: int
    shares_count: int
    important: bool
    pinned: bool
    created_at: datetime
    author: UserPublic
    # True quando o bairro atual do autor é o mesmo do post — exibe o selo de Morador.
    author_is_resident: bool = False
    liked: bool = False
    # True quando o usuário logado deu repost simples (sem citação) neste post.
    reposted: bool = False
    # Preenchido quando este post é uma citação (repost com comentário, estilo
    # Twitter) — no máximo um dos dois.
    quoted_post: Optional[SharedPostOut] = None
    quoted_comment: Optional[SharedCommentOut] = None
    poll: Optional[PollOut] = None

    model_config = {"from_attributes": True}


class PostFeed(BaseModel):
    items: list[PostOut]
    total: int
    page: int
    page_size: int
