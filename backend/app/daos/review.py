from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.review import Review


def get_by_user(db: Session, user_id: int) -> Review | None:
    return db.query(Review).filter(Review.user_id == user_id).first()


def get_by_id(db: Session, review_id: int) -> Review | None:
    return db.get(Review, review_id)


def upsert(db: Session, user_id: int, rating: float, comment: str) -> Review:
    review = get_by_user(db, user_id)
    if review:
        review.rating = rating
        review.comment = comment
    else:
        review = Review(user_id=user_id, rating=rating, comment=comment)
        db.add(review)
    db.commit()
    db.refresh(review)
    return review


def list_all(db: Session, offset: int, limit: int) -> list[Review]:
    return db.query(Review).order_by(desc(Review.updated_at)).offset(offset).limit(limit).all()


def count(db: Session) -> int:
    return db.query(func.count(Review.id)).scalar() or 0


def average(db: Session) -> float | None:
    return db.query(func.avg(Review.rating)).scalar()


def delete(db: Session, review: Review) -> None:
    db.delete(review)
    db.commit()
