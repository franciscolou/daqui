from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))  # legado; ver image_urls
    image_urls: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    neighborhood: Mapped[str] = mapped_column(String(120), default="")
    # Local do post (endereço validado no bairro) + coordenadas p/ o mapa.
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    author: Mapped["User"] = relationship("User", back_populates="posts")  # noqa: F821
    likes: Mapped[list["PostLike"]] = relationship(
        "PostLike", back_populates="post", lazy="select", cascade="all, delete-orphan"
    )
    comments: Mapped[list["Comment"]] = relationship(  # noqa: F821
        "Comment", back_populates="post", lazy="select", cascade="all, delete-orphan"
    )
    poll_options: Mapped[list["PollOption"]] = relationship(
        "PollOption",
        back_populates="post",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="PollOption.position",
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
