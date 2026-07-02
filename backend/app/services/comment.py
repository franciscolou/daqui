from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import comment as comment_dao
from app.daos import post as post_dao
from app.models.comment import Comment
from app.models.user import User
from app.schemas.comment import CommentCreate


def _visible_post_or_404(db: Session, post_id: int, viewer: User):
    post = post_dao.get_by_id(db, post_id)
    # Isolamento por bairro: post de outro bairro é como se não existisse.
    if not post or post.neighborhood != viewer.neighborhood:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    return post


def list_for_post(db: Session, post_id: int, viewer: User) -> list[Comment]:
    _visible_post_or_404(db, post_id, viewer)
    return comment_dao.list_for_post(db, post_id)


def create(db: Session, post_id: int, user: User, payload: CommentCreate) -> Comment:
    post = _visible_post_or_404(db, post_id, user)

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comentário vazio")

    comment = comment_dao.create(
        db, post_id=post_id, author_id=user.id, content=content
    )
    post.comments_count = comment_dao.count_for_post(db, post_id)
    db.commit()
    return comment


def delete(db: Session, comment_id: int, user: User) -> None:
    comment = comment_dao.get_by_id(db, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")
    if comment.author_id != user.id:
        raise HTTPException(status_code=403, detail="Sem permissão")

    post_id = comment.post_id
    comment_dao.delete(db, comment)

    post = post_dao.get_by_id(db, post_id)
    if post:
        post.comments_count = comment_dao.count_for_post(db, post_id)
        db.commit()
