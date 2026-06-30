from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import post, user
from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostCreate, PostFeed, PostOut


def _to_schema(post: Post, viewer: User, db: Session) -> PostOut:
    liked = post.get_like(db, post.id, viewer.id) is not None
    return PostOut(
        id=post.id,
        category=post.category,
        title=post.title,
        content=post.content,
        image_url=post.image_url,
        neighborhood=post.neighborhood,
        likes_count=post.likes_count,
        comments_count=post.comments_count,
        shares_count=post.shares_count,
        urgent=post.urgent,
        pinned=post.pinned,
        created_at=post.created_at,
        author=post.author,
        liked=liked,
    )


def get_feed(
    db: Session,
    user: User,
    category: str | None,
    page: int,
    page_size: int,
) -> PostFeed:
    offset = (page - 1) * page_size
    posts = post.list_feed(db, user.neighborhood, category, offset, page_size)
    total = post.count_feed(db, user.neighborhood, category)
    return PostFeed(
        items=[_to_schema(p, user, db) for p in posts],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_post(db: Session, post_id: int, viewer: User) -> PostOut:
    post = post.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    return _to_schema(post, viewer, db)


def create_post(db: Session, user: User, payload: PostCreate) -> PostOut:
    post = post.create(
        db,
        author_id=user.id,
        category=payload.category,
        title=payload.title,
        content=payload.content,
        image_url=payload.image_url,
        urgent=payload.urgent,
        neighborhood=user.neighborhood,
    )
    user.update(db, user, {"posts_count": user.posts_count + 1})
    return _to_schema(post, user, db)


def toggle_like(db: Session, post_id: int, user: User) -> PostOut:
    post = post.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")

    existing = post.get_like(db, post_id, user.id)
    if existing:
        post.remove_like(db, existing)
        post.likes_count = max(0, post.likes_count - 1)
    else:
        post.add_like(db, post_id, user.id)
        post.likes_count += 1

    db.commit()
    db.refresh(post)
    return _to_schema(post, user, db)


def delete_post(db: Session, post_id: int, user: User) -> None:
    post = post.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Sem permissão")

    post.delete(db, post)
    user.update(db, user, {"posts_count": max(0, user.posts_count - 1)})
