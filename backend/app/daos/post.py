from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from app.models.post import PollOption, PollVote, Post, PostLike
from app.models.user import User


def get_by_id(db: Session, post_id: int) -> Post | None:
    return db.get(Post, post_id)


def list_feed(
    db: Session,
    neighborhoods: list[str],
    category: str | None,
    offset: int,
    limit: int,
) -> list[Post]:
    q = db.query(Post).filter(Post.neighborhood.in_(neighborhoods))
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


def count_by_author(db: Session, author_id: int) -> int:
    return db.query(Post).filter(Post.author_id == author_id).count()


def count_feed(db: Session, neighborhoods: list[str], category: str | None) -> int:
    q = db.query(Post).filter(Post.neighborhood.in_(neighborhoods))
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
    image_urls: list[str],
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
        image_urls=image_urls,
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


# ── Enquete ───────────────────────────────────────────────────────────
def add_poll_option(db: Session, post_id: int, text: str, position: int) -> PollOption:
    option = PollOption(post_id=post_id, text=text, position=position, votes_count=0)
    db.add(option)
    return option


def get_option(db: Session, option_id: int) -> PollOption | None:
    return db.get(PollOption, option_id)


def delete_poll_option(db: Session, option: PollOption) -> None:
    # Remove também os votos ligados a essa opção (cascade da relação).
    db.delete(option)


def get_user_votes(db: Session, post_id: int, user_id: int) -> list[int]:
    rows = (
        db.query(PollVote.option_id)
        .filter(PollVote.post_id == post_id, PollVote.user_id == user_id)
        .all()
    )
    return [r[0] for r in rows]


def clear_user_votes(db: Session, post_id: int, user_id: int) -> None:
    db.query(PollVote).filter(
        PollVote.post_id == post_id, PollVote.user_id == user_id
    ).delete()


def add_vote(db: Session, post_id: int, option_id: int, user_id: int) -> None:
    db.add(PollVote(post_id=post_id, option_id=option_id, user_id=user_id))


def recount_options(db: Session, post: Post) -> None:
    """Recalcula votes_count de cada opção a partir da tabela de votos."""
    counts = dict(
        db.query(PollVote.option_id, func.count(PollVote.id))
        .filter(PollVote.post_id == post.id)
        .group_by(PollVote.option_id)
        .all()
    )
    for opt in post.poll_options:
        opt.votes_count = counts.get(opt.id, 0)
