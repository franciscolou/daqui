from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import comment as comment_dao
from app.daos import post as post_dao
from app.daos import user as user_dao
from app.models.audit_log import ACTION_COMMENT_DELETE
from app.models.comment import Comment
from app.models.notification import TYPE_COMMENT_REMOVED
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentOut
from app.schemas.user import UserPublic
from app.services import audit_log as audit_log_service
from app.services import mentions
from app.services import notification as notification_service


def _visible_post_or_404(db: Session, post_id: int, viewer: User):
    post = post_dao.get_by_id(db, post_id)
    # Qualquer usuário pode ver e comentar qualquer post (o isolamento fica só
    # no feed, que não exibe posts de outros bairros espontaneamente).
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    return post


def _to_schema(
    comment: Comment, liked: bool, replies_count: int = 0, reposted: bool = False
) -> CommentOut:
    # Morador: o bairro atual do autor é o mesmo do post comentado (mesma regra do post).
    post_neighborhood = comment.post.neighborhood if comment.post else ""
    author_is_resident = bool(post_neighborhood) and comment.author.neighborhood == post_neighborhood
    return CommentOut(
        id=comment.id,
        post_id=comment.post_id,
        parent_id=comment.parent_id,
        content=comment.content,
        created_at=comment.created_at,
        author=UserPublic.model_validate(comment.author),
        author_is_resident=author_is_resident,
        likes_count=comment.likes_count,
        liked=liked,
        reposts_count=comment.reposts_count,
        reposted=reposted,
        replies_count=replies_count,
    )


def _serialize_many(db: Session, comments: list[Comment], viewer: User) -> list[CommentOut]:
    """Serializa uma lista de comentários já com `liked` e a contagem de respostas."""
    ids = [c.id for c in comments]
    liked_ids = comment_dao.liked_ids_among(db, ids, viewer.id)
    reposted_ids = comment_dao.reposted_ids_among(db, ids, viewer.id)
    reply_counts = comment_dao.reply_counts(db, ids)
    return [
        _to_schema(c, c.id in liked_ids, reply_counts.get(c.id, 0), c.id in reposted_ids)
        for c in comments
    ]


def list_for_post(db: Session, post_id: int, viewer: User) -> list[CommentOut]:
    _visible_post_or_404(db, post_id, viewer)
    # Apenas comentários de topo; as respostas vêm sob demanda via list_replies.
    comments = comment_dao.list_for_post(db, post_id)
    return _serialize_many(db, comments, viewer)


def list_replies(db: Session, comment_id: int, viewer: User) -> list[CommentOut]:
    parent = comment_dao.get_by_id(db, comment_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")
    replies = comment_dao.list_replies(db, comment_id)
    return _serialize_many(db, replies, viewer)


def create(db: Session, post_id: int, user: User, payload: CommentCreate) -> CommentOut:
    post = _visible_post_or_404(db, post_id, user)

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comentário vazio")

    # Resposta a outro comentário (thread): valida que o pai é do mesmo post.
    if payload.parent_id is not None:
        parent = comment_dao.get_by_id(db, payload.parent_id)
        if not parent or parent.post_id != post_id:
            raise HTTPException(status_code=404, detail="Comentário respondido não encontrado")

    comment = comment_dao.create(
        db, post_id=post_id, author_id=user.id, content=content, parent_id=payload.parent_id
    )
    post.comments_count = comment_dao.count_for_post(db, post_id)
    user.comments_count = comment_dao.count_by_author(db, user.id)
    db.commit()
    db.refresh(comment)

    # Notifica @menções no comentário (leva pro post ao tocar na novidade).
    mentions.notify_mentions(db, user, content, post_id, content)
    return _to_schema(comment, liked=False)


def get(db: Session, comment_id: int, viewer: User) -> CommentOut:
    comment = comment_dao.get_by_id(db, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")
    liked = comment_dao.get_like(db, comment_id, viewer.id) is not None
    reposted = comment_dao.get_repost(db, comment_id, viewer.id) is not None or (
        comment_dao.count_quotes_by_author(db, comment_id, viewer.id) > 0
    )
    return _to_schema(comment, liked, reposted=reposted)


def toggle_like(db: Session, comment_id: int, user: User) -> CommentOut:
    comment = comment_dao.get_by_id(db, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")

    existing = comment_dao.get_like(db, comment_id, user.id)
    if existing:
        comment_dao.remove_like(db, existing)
        comment.likes_count = max(0, comment.likes_count - 1)
        liked = False
    else:
        comment_dao.add_like(db, comment_id, user.id)
        comment.likes_count += 1
        liked = True

    db.commit()
    db.refresh(comment)
    return _to_schema(comment, liked)


def toggle_repost(db: Session, comment_id: int, user: User) -> CommentOut:
    comment = comment_dao.get_by_id(db, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")

    existing = comment_dao.get_repost(db, comment_id, user.id)
    if existing:
        comment_dao.remove_repost(db, existing)
        comment.reposts_count = max(0, comment.reposts_count - 1)
        reposted = False
    else:
        comment_dao.add_repost(db, comment_id, user.id)
        comment.reposts_count += 1
        reposted = True

    db.commit()
    db.refresh(comment)
    liked = comment_dao.get_like(db, comment_id, user.id) is not None
    return _to_schema(comment, liked, reposted=reposted)


def delete(db: Session, comment_id: int, user: User) -> None:
    comment = comment_dao.get_by_id(db, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")

    post = post_dao.get_by_id(db, comment.post_id)
    # Pode excluir: (1) o autor do comentário; (2) o autor do post (qualquer
    # comentário do seu post). Ser autor de um comentário-pai NÃO dá poder sobre
    # as respostas — só o autor do post pode removê-las.
    is_comment_author = comment.author_id == user.id
    is_post_author = post is not None and post.author_id == user.id
    if not (is_comment_author or is_post_author):
        raise HTTPException(status_code=403, detail="Sem permissão")

    author_id = comment.author_id
    comment_dao.delete(db, comment)

    if post:
        post.comments_count = comment_dao.count_for_post(db, post.id)
    # Atualiza o contador denormalizado do autor do comentário removido.
    author = user_dao.get_by_id(db, author_id)
    if author:
        author.comments_count = comment_dao.count_by_author(db, author_id)
    db.commit()


# ── Moderação ─────────────────────────────────────────────────────────
def admin_list_by_author(db: Session, author_id: int) -> list[Comment]:
    return comment_dao.list_by_author(db, author_id)


def admin_delete(db: Session, comment_id: int, moderator: User) -> None:
    comment = comment_dao.get_by_id(db, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")

    post_id = comment.post_id
    author_id = comment.author_id
    content_preview = comment.content[:200]
    snapshot = {"content": comment.content, "created_at": comment.created_at.isoformat()}
    comment_dao.delete(db, comment)

    post = post_dao.get_by_id(db, post_id)
    if post:
        post.comments_count = comment_dao.count_for_post(db, post_id)
    author = user_dao.get_by_id(db, author_id)
    if author:
        author.comments_count = comment_dao.count_by_author(db, author_id)
    db.commit()

    notification_service.notify(
        db,
        user_id=author_id,
        type_=TYPE_COMMENT_REMOVED,
        content="Seu comentário foi removido pela moderação por não seguir as diretrizes da comunidade.",
        target_text=content_preview,
        snapshot=snapshot,
        push_title="Aviso da moderação",
        push_body="Seu comentário foi removido por não seguir as diretrizes da comunidade.",
    )
    audit_log_service.log(db, moderator, ACTION_COMMENT_DELETE, author_id, content_preview)
