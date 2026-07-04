from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import review as review_dao
from app.models.audit_log import ACTION_REVIEW_DELETE
from app.models.review import Review
from app.models.user import User
from app.schemas.review import (
    ReviewAdminOut,
    ReviewCreate,
    ReviewOut,
    ReviewStats,
)
from app.schemas.user import UserPublic
from app.services import audit_log as audit_log_service


def submit(db: Session, user: User, payload: ReviewCreate) -> ReviewOut:
    review = review_dao.upsert(db, user.id, payload.rating, payload.comment)
    return ReviewOut.model_validate(review)


def get_mine(db: Session, user: User) -> ReviewOut | None:
    review = review_dao.get_by_user(db, user.id)
    return ReviewOut.model_validate(review) if review else None


# ── Moderação ─────────────────────────────────────────────────────────
# Avaliação é a opinião do usuário: a moderação não aprova/rejeita, só pode
# excluir avaliações abusivas/spam (registrado no log de auditoria).
def _admin_out(review: Review) -> ReviewAdminOut:
    out = ReviewAdminOut.model_validate(review)
    out.author = UserPublic.model_validate(review.author)
    return out


def admin_list(db: Session, page: int, page_size: int) -> list[ReviewAdminOut]:
    offset = (page - 1) * page_size
    reviews = review_dao.list_all(db, offset, page_size)
    return [_admin_out(r) for r in reviews]


def admin_stats(db: Session) -> ReviewStats:
    avg = review_dao.average(db)
    return ReviewStats(
        total=review_dao.count(db),
        average=round(avg, 2) if avg is not None else None,
    )


def admin_delete(db: Session, review_id: int, moderator: User) -> None:
    review = review_dao.get_by_id(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")
    target_user_id = review.user_id
    detail = f"Nota {review.rating} — " + (review.comment[:200] if review.comment else "sem comentário")
    review_dao.delete(db, review)
    audit_log_service.log(db, moderator, ACTION_REVIEW_DELETE, target_user_id, detail)
