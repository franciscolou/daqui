from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import comment as comment_dao
from app.daos import post as post_dao
from app.daos import user as user_dao
from app.models.audit_log import AuditLogAction
from app.models.comment import Comment
from app.models.notification import NotificationType
from app.models.post import Post
from app.models.user import User
from app.schemas.trash import TrashItemOut
from app.services import audit_log as audit_log_service
from app.services import notification as notification_service

RETENTION_DAYS = 60


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _expires_at(value: datetime) -> datetime:
    return _aware(value) + timedelta(days=RETENTION_DAYS)


def _recount_users(db: Session, user_ids: set[int]) -> None:
    for user_id in user_ids:
        user = user_dao.get_by_id(db, user_id)
        if user:
            user.posts_count = post_dao.count_by_author(db, user_id)
            user.comments_count = comment_dao.count_by_author(db, user_id)


def purge_expired(db: Session) -> None:
    """Apaga definitivamente itens vencidos. Executada no acesso à lixeira e
    na inicialização; pode também ser chamada por um job externo sem efeitos colaterais."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    posts = db.query(Post).filter(Post.moderation_deleted_at <= cutoff).all()
    deleted_post_ids = {post.id for post in posts}
    comments = (
        db.query(Comment)
        .filter(
            Comment.moderation_deleted_at <= cutoff,
            Comment.moderation_deleted_root_id == Comment.id,
        )
        .all()
    )
    comments = [comment for comment in comments if comment.post_id not in deleted_post_ids]
    affected = {p.author_id for p in posts}
    affected.update(comment.author_id for post in posts for comment in post.comments)
    affected.update(
        row.author_id
        for root in comments
        for row in db.query(Comment).filter(Comment.moderation_deleted_root_id == root.id).all()
    )
    for post in posts:
        db.delete(post)
    for root in comments:
        # A relação cascade remove toda a subárvore deste item.
        db.delete(root)
    db.flush()
    _recount_users(db, affected)
    db.commit()


def list_items(db: Session) -> list[TrashItemOut]:
    purge_expired(db)
    posts = db.query(Post).filter(Post.moderation_deleted_at.is_not(None)).all()
    comments = (
        db.query(Comment)
        .filter(
            Comment.moderation_deleted_at.is_not(None),
            Comment.moderation_deleted_root_id == Comment.id,
        )
        .all()
    )
    items: list[TrashItemOut] = []
    for item_type, rows in (("post", posts), ("comment", comments)):
        for row in rows:
            deleted_at = _aware(row.moderation_deleted_at)
            deleted_by = user_dao.get_by_id(db, row.moderation_deleted_by_id)
            if deleted_by is None:
                continue
            items.append(
                TrashItemOut(
                    id=row.id,
                    type=item_type,
                    title=row.title if item_type == "post" else None,
                    content=row.content,
                    created_at=row.created_at,
                    deleted_at=deleted_at,
                    expires_at=_expires_at(deleted_at),
                    author=row.author,
                    deleted_by=deleted_by,
                )
            )
    return sorted(items, key=lambda item: item.deleted_at, reverse=True)


def restore(db: Session, item_type: str, item_id: int, moderator: User) -> None:
    if item_type == "post":
        post = post_dao.get_by_id_including_deleted(db, item_id)
        if not post or post.moderation_deleted_at is None:
            raise HTTPException(status_code=404, detail="Item não encontrado na lixeira")
        if _expires_at(post.moderation_deleted_at) <= datetime.now(timezone.utc):
            purge_expired(db)
            raise HTTPException(status_code=410, detail="O prazo de restauração expirou")
        post.moderation_deleted_at = None
        post.moderation_deleted_by_id = None
        affected_authors = {post.author_id} | {comment.author_id for comment in post.comments}
        author_id = post.author_id
        detail = post.content[:200]
        action = AuditLogAction.POST_RESTORE
    elif item_type == "comment":
        root = comment_dao.get_by_id_including_deleted(db, item_id)
        if not root or root.moderation_deleted_root_id != item_id:
            raise HTTPException(status_code=404, detail="Item não encontrado na lixeira")
        if _expires_at(root.moderation_deleted_at) <= datetime.now(timezone.utc):
            purge_expired(db)
            raise HTTPException(status_code=410, detail="O prazo de restauração expirou")
        rows = db.query(Comment).filter(Comment.moderation_deleted_root_id == item_id).all()
        affected_authors = {row.author_id for row in rows}
        for row in rows:
            row.moderation_deleted_at = None
            row.moderation_deleted_by_id = None
            row.moderation_deleted_root_id = None
        author_id = root.author_id
        detail = root.content[:200]
        action = AuditLogAction.COMMENT_RESTORE
    else:
        raise HTTPException(status_code=404, detail="Tipo de item inválido")
    db.flush()
    if item_type == "comment":
        post = post_dao.get_by_id(db, root.post_id)
        if post:
            post.comments_count = comment_dao.count_for_post(db, post.id)
    _recount_users(db, affected_authors)
    db.commit()
    if item_type == "post":
        notification_service.notify(
            db,
            user_id=author_id,
            type_=NotificationType.POST_RESTORED,
            content="Seu post foi restaurado pela moderação.",
            target_text=detail,
            post_id=post.id,
            push_title="Aviso da moderação",
            push_body="Seu post foi restaurado pela moderação.",
        )
    else:
        notification_service.notify(
            db,
            user_id=author_id,
            type_=NotificationType.COMMENT_RESTORED,
            content="Seu comentário foi restaurado pela moderação.",
            target_text=detail,
            post_id=root.post_id,
            push_title="Aviso da moderação",
            push_body="Seu comentário foi restaurado pela moderação.",
        )
    audit_log_service.log(db, moderator, action, author_id, detail)
