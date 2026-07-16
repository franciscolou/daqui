from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.comment import Comment, CommentLike, CommentRepost
from app.models.post import Post


def list_for_post(db: Session, post_id: int) -> list[Comment]:
    # Apenas os comentários de topo (respostas são carregadas sob demanda, via
    # list_replies). Mais recentes primeiro.
    return (
        db.query(Comment)
        .filter(Comment.post_id == post_id, Comment.parent_id.is_(None))
        .order_by(desc(Comment.created_at))
        .all()
    )


def list_replies(db: Session, parent_id: int) -> list[Comment]:
    # Respostas diretas de um comentário, mais recentes primeiro.
    return (
        db.query(Comment)
        .filter(Comment.parent_id == parent_id)
        .order_by(desc(Comment.created_at))
        .all()
    )


def reply_counts(db: Session, parent_ids: list[int]) -> dict[int, int]:
    """Quantidade de respostas diretas por comentário (para o botão 'Ver respostas')."""
    if not parent_ids:
        return {}
    rows = (
        db.query(Comment.parent_id, func.count(Comment.id))
        .filter(Comment.parent_id.in_(parent_ids))
        .group_by(Comment.parent_id)
        .all()
    )
    return {pid: count for pid, count in rows}


def get_by_id(db: Session, comment_id: int) -> Comment | None:
    return db.get(Comment, comment_id)


def list_by_author(db: Session, author_id: int) -> list[Comment]:
    return (
        db.query(Comment)
        .filter(Comment.author_id == author_id)
        .order_by(desc(Comment.created_at))
        .all()
    )


def create(
    db: Session,
    *,
    post_id: int,
    author_id: int,
    content: str,
    parent_id: int | None = None,
) -> Comment:
    comment = Comment(
        post_id=post_id, author_id=author_id, content=content, parent_id=parent_id
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def delete(db: Session, comment: Comment) -> None:
    db.delete(comment)
    db.commit()


def count_for_post(db: Session, post_id: int) -> int:
    return db.query(Comment).filter(Comment.post_id == post_id).count()


def count_by_author(db: Session, author_id: int) -> int:
    return db.query(Comment).filter(Comment.author_id == author_id).count()


# ── Curtidas ──────────────────────────────────────────────────────────
def get_like(db: Session, comment_id: int, user_id: int) -> CommentLike | None:
    return (
        db.query(CommentLike)
        .filter(CommentLike.comment_id == comment_id, CommentLike.user_id == user_id)
        .first()
    )


def add_like(db: Session, comment_id: int, user_id: int) -> None:
    db.add(CommentLike(comment_id=comment_id, user_id=user_id))


def remove_like(db: Session, like: CommentLike) -> None:
    db.delete(like)


def liked_ids_among(db: Session, comment_ids: list[int], user_id: int) -> set[int]:
    """Ids curtidos pelo usuário dentre um conjunto de comentários (marca `liked`)."""
    if not comment_ids:
        return set()
    rows = (
        db.query(CommentLike.comment_id)
        .filter(CommentLike.comment_id.in_(comment_ids), CommentLike.user_id == user_id)
        .all()
    )
    return {r[0] for r in rows}


# ── Repost simples (sem citação) ─────────────────────────────────────
def get_repost(db: Session, comment_id: int, user_id: int) -> CommentRepost | None:
    return (
        db.query(CommentRepost)
        .filter(CommentRepost.comment_id == comment_id, CommentRepost.user_id == user_id)
        .first()
    )


def add_repost(db: Session, comment_id: int, user_id: int) -> None:
    db.add(CommentRepost(comment_id=comment_id, user_id=user_id))


def remove_repost(db: Session, repost: CommentRepost) -> None:
    db.delete(repost)


def reposted_ids_among(db: Session, comment_ids: list[int], user_id: int) -> set[int]:
    """Ids repostados (simples) pelo usuário dentre um conjunto de comentários."""
    if not comment_ids:
        return set()
    rows = (
        db.query(CommentRepost.comment_id)
        .filter(CommentRepost.comment_id.in_(comment_ids), CommentRepost.user_id == user_id)
        .all()
    )
    return {r[0] for r in rows}


def count_quotes_by_author(db: Session, comment_id: int, author_id: int) -> int:
    """Quantas vezes o usuário já citou este comentário (posts próprios com
    quoted_comment_id apontando pra ele) — usado só pra decidir o estado do botão."""
    return (
        db.query(Post)
        .filter(Post.quoted_comment_id == comment_id, Post.author_id == author_id)
        .count()
    )
