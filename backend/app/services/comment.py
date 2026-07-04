from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import comment as comment_dao
from app.daos import post as post_dao
from app.daos import user as user_dao
from app.models.comment import Comment
from app.models.user import User
from app.schemas.comment import CommentCreate


def _visible_post_or_404(db: Session, post_id: int, viewer: User):
    post = post_dao.get_by_id(db, post_id)
    # Isolamento por bairro: post de outro bairro é como se não existisse.
    # Moderador não tem essa restrição — pode ver comentários de qualquer bairro.
    if not post or (post.neighborhood != viewer.neighborhood and not viewer.is_moderator):
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
    user.comments_count = comment_dao.count_by_author(db, user.id)
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
    user.comments_count = comment_dao.count_by_author(db, user.id)
    db.commit()


# ── Moderação ─────────────────────────────────────────────────────────
def admin_list_by_author(db: Session, author_id: int) -> list[Comment]:
    return comment_dao.list_by_author(db, author_id)


def admin_delete(db: Session, comment_id: int) -> None:
    comment = comment_dao.get_by_id(db, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")

    post_id = comment.post_id
    author_id = comment.author_id
    comment_dao.delete(db, comment)

    post = post_dao.get_by_id(db, post_id)
    if post:
        post.comments_count = comment_dao.count_for_post(db, post_id)
    author = user_dao.get_by_id(db, author_id)
    if author:
        author.comments_count = comment_dao.count_by_author(db, author_id)
    db.commit()
