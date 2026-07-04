from typing import Optional

from fastapi import Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.deps import get_current_moderator, get_current_user, get_db
from app.models.user import User
from app.schemas.post import PollVoteIn, PostCreate, PostFeed, PostOut, PostUpdate
from app.services import post


def get_feed(
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PostFeed:
    return post.get_feed(db, current_user, category, page, page_size)


def list_by_author(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PostOut]:
    return post.list_by_author(db, user_id, current_user)


def get_top_important(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Optional[PostOut]:
    return post.get_top_important(db, current_user)


def get_map_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PostOut]:
    return post.get_map_posts(db, current_user)


def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PostOut:
    return post.get_post(db, post_id, current_user)


def create_post(
    payload: PostCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PostOut:
    return post.create_post(db, current_user, payload, str(request.base_url))


def update_post(
    post_id: int,
    payload: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PostOut:
    return post.update_post(db, post_id, current_user, payload)


def vote_poll(
    post_id: int,
    payload: PollVoteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PostOut:
    return post.vote_poll(db, post_id, current_user, payload.option_ids)


def unvote_poll(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PostOut:
    return post.unvote_poll(db, post_id, current_user)


def toggle_like(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PostOut:
    return post.toggle_like(db, post_id, current_user)


def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    post.delete_post(db, post_id, current_user)


# ── Moderador (app de moderação) ──────────────────────────────────────
def admin_list_by_author(
    user_id: int,
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> list[PostOut]:
    return post.admin_list_by_author(db, user_id, _mod)


def admin_delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> None:
    post.admin_delete_post(db, post_id, _mod)
