from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    neighborhood: Mapped[str] = mapped_column(String(120), default="")
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    shares_count: Mapped[int] = mapped_column(Integer, default=0)
    urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
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


class PostLike(Base):
    __tablename__ = "post_likes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    post: Mapped["Post"] = relationship("Post", back_populates="likes")
