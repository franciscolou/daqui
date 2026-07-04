from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.comment import Comment


def list_for_post(db: Session, post_id: int) -> list[Comment]:
    return (
        db.query(Comment)
        .filter(Comment.post_id == post_id)
        .order_by(desc(Comment.created_at))
        .all()
    )


def get_by_id(db: Session, comment_id: int) -> Comment | None:
    return db.get(Comment, comment_id)


def list_by_author(db: Session, author_id: int) -> list[Comment]:
    return (
        db.query(Comment)
        .filter(Comment.author_id == author_id)
        .order_by(desc(Comment.created_at))
        .all()
    )


def create(db: Session, *, post_id: int, author_id: int, content: str) -> Comment:
    comment = Comment(post_id=post_id, author_id=author_id, content=content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def delete(db: Session, comment: Comment) -> None:
    db.delete(comment)
    db.commit()


def count_for_post(db: Session, post_id: int) -> int:
    return db.query(Comment).filter(Comment.post_id == post_id).count()
