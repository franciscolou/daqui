from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_moderator, get_current_user, get_db
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentOut
from app.services import comment


def list_comments(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CommentOut]:
    return comment.list_for_post(db, post_id, current_user)


def get_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentOut:
    return comment.get(db, comment_id, current_user)


def list_replies(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CommentOut]:
    return comment.list_replies(db, comment_id, current_user)


def create_comment(
    post_id: int,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentOut:
    return comment.create(db, post_id, current_user, payload)


def toggle_comment_like(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentOut:
    return comment.toggle_like(db, comment_id, current_user)


def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    comment.delete(db, comment_id, current_user)


# ── Moderador (app de moderação) ──────────────────────────────────────
def admin_list_by_author(
    user_id: int,
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> list[CommentOut]:
    return comment.admin_list_by_author(db, user_id)


def admin_delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> None:
    comment.admin_delete(db, comment_id, _mod)
