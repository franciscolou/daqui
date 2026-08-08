from datetime import datetime, timezone
from enum import StrEnum
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PostCategory(StrEnum):
    AVISO = "aviso"
    EVENTO = "evento"
    RECOMENDACAO = "recomendacao"
    SEGURANCA = "seguranca"
    AJUDA = "ajuda"
    GERAL = "geral"
    PETS = "pets"
    VENDA = "venda"
    PERDIDOS = "perdidos"
    # Enquete: post com PollOption/PollVote em vez de conteúdo livre (ver poll_multiple/poll_closes_at).
    ENQUETE = "enquete"


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    category: Mapped[PostCategory] = mapped_column(String(30), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))  # legado; ver media
    # legado; ver media — mantida só pela migração de backfill em database.py
    _image_urls_legacy: Mapped[Optional[list[str]]] = mapped_column(
        "image_urls", JSON, nullable=True
    )
    # Galeria mista de imagens/vídeos: [{"url": ..., "type": "image"|"video"}, ...]
    media: Mapped[Optional[list[dict]]] = mapped_column(JSON, nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    neighborhood: Mapped[str] = mapped_column(String(120), default="")
    # Local do post (endereço validado no bairro) + coordenadas p/ o mapa.
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # Indexadas: o mapa agora consulta por bounding box (`daos/post.py::list_map`),
    # sem filtro de bairro. Índice novo só entra num banco recriado do zero
    # (create_all não altera tabela já existente) — em dev, apagar daqui.db e
    # rodar o seed de novo se quiser o índice localmente.
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True, index=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True, index=True)
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    shares_count: Mapped[int] = mapped_column(Integer, default=0)
    important: Mapped[bool] = mapped_column(Boolean, default=False)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    # Enquete (category == "enquete"): se permite votos múltiplos e o prazo de encerramento.
    poll_multiple: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    poll_closes_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Repost com citação (estilo Twitter): no máximo um dos dois é preenchido —
    # o post/comentário original que este post cita. Sem cascade explícito:
    # se o original for apagado, a relação simplesmente resolve pra None (mesmo
    # comportamento de Message.shared_post_id).
    quoted_post_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("posts.id"), nullable=True
    )
    quoted_comment_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("comments.id"), nullable=True
    )
    # Repost com citação de um ANÚNCIO (ads-backend — banco separado, zero
    # cross-import). Opaco aqui e nunca validado, mesmo tratamento que
    # Message.shared_ad_id já dá a esse tipo de referência; no máximo um dos
    # três "quoted_*" é preenchido (ver services/post.py::create_post).
    quoted_ad_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    @property
    def image_urls(self) -> list[str]:
        """Compat: só as imagens de `media` (usada por previews que não tocam
        vídeo — snapshot de moderação, prévia de encaminhamento, pin do mapa)."""
        return [m["url"] for m in (self.media or []) if m.get("type", "image") == "image"]

    author: Mapped["User"] = relationship("User", back_populates="posts")  # noqa: F821
    likes: Mapped[list["PostLike"]] = relationship(
        "PostLike", back_populates="post", lazy="select", cascade="all, delete-orphan"
    )
    comments: Mapped[list["Comment"]] = relationship(  # noqa: F821
        "Comment",
        back_populates="post",
        foreign_keys="Comment.post_id",
        lazy="select",
        cascade="all, delete-orphan",
    )
    poll_options: Mapped[list["PollOption"]] = relationship(
        "PollOption",
        back_populates="post",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="PollOption.position",
    )
    quoted_post: Mapped[Optional["Post"]] = relationship(
        "Post", remote_side=[id], foreign_keys=[quoted_post_id]
    )
    quoted_comment: Mapped[Optional["Comment"]] = relationship(  # noqa: F821
        "Comment", foreign_keys=[quoted_comment_id]
    )


class PostLike(Base):
    __tablename__ = "post_likes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    post: Mapped["Post"] = relationship("Post", back_populates="likes")


class PostRepost(Base):
    """Repost simples (sem citação), estilo "retweet" — 1 por usuário por post."""

    __tablename__ = "post_reposts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PollOption(Base):
    __tablename__ = "poll_options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False, index=True)
    text: Mapped[str] = mapped_column(String(200), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    votes_count: Mapped[int] = mapped_column(Integer, default=0)

    post: Mapped["Post"] = relationship("Post", back_populates="poll_options")
    votes: Mapped[list["PollVote"]] = relationship(
        "PollVote", back_populates="option", cascade="all, delete-orphan"
    )


class PollVote(Base):
    __tablename__ = "poll_votes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False, index=True)
    option_id: Mapped[int] = mapped_column(
        ForeignKey("poll_options.id"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    option: Mapped["PollOption"] = relationship("PollOption", back_populates="votes")
