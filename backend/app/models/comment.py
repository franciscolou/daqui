from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # Comentário respondido (thread recursiva). Nulo = comentário de topo.
    parent_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("comments.id"), nullable=True, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Foto anexada à resposta (opcional; comentário pode ser só imagem, sem texto).
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    reposts_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    moderation_deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    moderation_deleted_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    # Todas as respostas ocultadas junto com um comentário apontam para a raiz.
    # Assim a lixeira exibe um único item e restaura a subárvore inteira.
    moderation_deleted_root_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    author: Mapped["User"] = relationship("User", foreign_keys=[author_id])  # noqa: F821
    post: Mapped["Post"] = relationship(  # noqa: F821
        "Post", back_populates="comments", foreign_keys=[post_id]
    )

    @property
    def post_public_id(self) -> str | None:
        """Identificador de URL do post pai — usada por SharedCommentOut pra
        montar o link `/post/{username}/status/{public_id}` de uma prévia de
        comentário encaminhada, sem expor o `post_id` sequencial. None no
        raro caso de post pai ausente (mesma defesa de services/comment.py::_to_schema)."""
        return self.post.public_id if self.post else None

    @property
    def post_author_username(self) -> str | None:
        return self.post.author.username if self.post else None
    # Respostas: apagar um comentário apaga a sub-thread inteira (cascade).
    replies: Mapped[list["Comment"]] = relationship(
        "Comment",
        back_populates="parent",
        cascade="all, delete-orphan",
        lazy="select",
    )
    parent: Mapped[Optional["Comment"]] = relationship(
        "Comment", back_populates="replies", remote_side=[id]
    )
    likes: Mapped[list["CommentLike"]] = relationship(
        "CommentLike", back_populates="comment", lazy="select", cascade="all, delete-orphan"
    )


class CommentLike(Base):
    __tablename__ = "comment_likes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    comment: Mapped["Comment"] = relationship("Comment", back_populates="likes")


class CommentRepost(Base):
    """Repost simples (sem citação) de um comentário — 1 por usuário por comentário."""

    __tablename__ = "comment_reposts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
