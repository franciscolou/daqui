from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.post import Post, PostLike


def get_by_id(db: Session, post_id: int) -> Post | None:
    return db.get(Post, post_id)


def list_feed(
    db: Session,
    neighborhood: str,
    category: str | None,
    offset: int,
    limit: int,
) -> list[Post]:
    q = db.query(Post).filter(Post.neighborhood == neighborhood)
    if category and category != "todos":
        q = q.filter(Post.category == category)
    return (
        q.order_by(desc(Post.pinned), desc(Post.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )


def count_feed(db: Session, neighborhood: str, category: str | None) -> int:
    q = db.query(Post).filter(Post.neighborhood == neighborhood)
    if category and category != "todos":
        q = q.filter(Post.category == category)
    return q.count()


def create(
    db: Session,
    *,
    author_id: int,
    category: str,
    title: str | None,
    content: str,
    image_url: str | None,
    urgent: bool,
    neighborhood: str,
) -> Post:
    post = Post(
        author_id=author_id,
        category=category,
        title=title,
        content=content,
        image_url=image_url,
        urgent=urgent,
        neighborhood=neighborhood,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def delete(db: Session, post: Post) -> None:
    db.delete(post)
    db.commit()


def get_like(db: Session, post_id: int, user_id: int) -> PostLike | None:
    return (
        db.query(PostLike)
        .filter(PostLike.post_id == post_id, PostLike.user_id == user_id)
        .first()
    )


def add_like(db: Session, post_id: int, user_id: int) -> None:
    db.add(PostLike(post_id=post_id, user_id=user_id))


def remove_like(db: Session, like: PostLike) -> None:
    db.delete(like)
