from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentOut
from app.services import comment


def list_comments(
    post_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CommentOut]:
    return comment.list_for_post(db, post_id)


def create_comment(
    post_id: int,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentOut:
    return comment.create(db, post_id, current_user, payload)


def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    comment.delete(db, comment_id, current_user)
