from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.daos import review as review_dao
from app.models.review import STATUSES, Review
from app.models.user import User
from app.schemas.review import (
    ReviewAdminOut,
    ReviewCreate,
    ReviewOut,
    ReviewStats,
)
from app.schemas.user import UserPublic


def submit(db: Session, user: User, payload: ReviewCreate) -> ReviewOut:
    review = review_dao.upsert(db, user.id, payload.rating, payload.comment)
    return ReviewOut.model_validate(review)


def get_mine(db: Session, user: User) -> ReviewOut | None:
    review = review_dao.get_by_user(db, user.id)
    return ReviewOut.model_validate(review) if review else None


# ── Moderação ─────────────────────────────────────────────────────────
def _admin_out(review: Review) -> ReviewAdminOut:
    out = ReviewAdminOut.model_validate(review)
    out.author = UserPublic.model_validate(review.author)
    return out


def admin_list(
    db: Session, status: str | None, page: int, page_size: int
) -> list[ReviewAdminOut]:
    if status and status not in STATUSES:
        raise HTTPException(status_code=400, detail="Status inválido")
    offset = (page - 1) * page_size
    reviews = review_dao.list_all(db, status, offset, page_size)
    return [_admin_out(r) for r in reviews]


def admin_stats(db: Session) -> ReviewStats:
    avg = review_dao.average(db)
    return ReviewStats(
        total=review_dao.count(db, None),
        average=round(avg, 2) if avg is not None else None,
        pending=review_dao.count(db, "pending"),
    )


def admin_set_status(db: Session, review_id: int, status: str) -> ReviewAdminOut:
    if status not in STATUSES:
        raise HTTPException(status_code=400, detail="Status inválido")
    review = review_dao.get_by_id(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")
    review = review_dao.set_status(db, review, status)
    return _admin_out(review)


def admin_delete(db: Session, review_id: int) -> None:
    review = review_dao.get_by_id(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")
    review_dao.delete(db, review)
