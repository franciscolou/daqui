from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_moderator, get_current_user, get_db
from app.models.user import User
from app.schemas.review import (
    ReviewAdminOut,
    ReviewCreate,
    ReviewOut,
    ReviewStats,
    ReviewStatusUpdate,
)
from app.services import review as review_service


# ── Usuário (app Daqui) ───────────────────────────────────────────────
def submit_review(
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReviewOut:
    return review_service.submit(db, current_user, payload)


def get_my_review(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReviewOut | None:
    return review_service.get_mine(db, current_user)


# ── Moderador (app de moderação) ──────────────────────────────────────
def list_reviews(
    status: str | None = Query(None, description="Filtra por status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> list[ReviewAdminOut]:
    return review_service.admin_list(db, status, page, page_size)


def reviews_stats(
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> ReviewStats:
    return review_service.admin_stats(db)


def set_review_status(
    review_id: int,
    payload: ReviewStatusUpdate,
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> ReviewAdminOut:
    return review_service.admin_set_status(db, review_id, payload.status)


def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> None:
    review_service.admin_delete(db, review_id)
