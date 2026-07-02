from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from app.models.post import Post, PostLike
from app.models.user import User


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


def top_important(db: Session, neighborhood: str) -> Post | None:
    return (
        db.query(Post)
        .filter(Post.neighborhood == neighborhood, Post.important.is_(True))
        .order_by(
            desc(Post.likes_count + Post.comments_count + Post.shares_count),
            desc(Post.created_at),
        )
        .first()
    )


def search(db: Session, neighborhood: str, query: str, limit: int = 30) -> list[Post]:
    like = f"%{query}%"
    return (
        db.query(Post)
        .join(User, Post.author_id == User.id)
        .filter(
            Post.neighborhood == neighborhood,
            or_(
                Post.title.ilike(like),
                Post.content.ilike(like),
                User.name.ilike(like),
            ),
        )
        .order_by(
            desc(Post.likes_count + Post.comments_count + Post.shares_count),
            desc(Post.created_at),
        )
        .limit(limit)
        .all()
    )


def list_map(db: Session, neighborhood: str, limit: int = 200) -> list[Post]:
    # Posts do bairro com coordenadas — viram pins no mapa.
    return (
        db.query(Post)
        .filter(Post.neighborhood == neighborhood, Post.latitude.isnot(None))
        .order_by(desc(Post.created_at))
        .limit(limit)
        .all()
    )


def list_by_author(db: Session, author_id: int) -> list[Post]:
    return (
        db.query(Post)
        .filter(Post.author_id == author_id)
        .order_by(desc(Post.created_at))
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
    details: dict | None,
    important: bool,
    neighborhood: str,
    location: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> Post:
    post = Post(
        author_id=author_id,
        category=category,
        title=title,
        content=content,
        image_url=image_url,
        details=details,
        important=important,
        neighborhood=neighborhood,
        location=location,
        latitude=latitude,
        longitude=longitude,
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
