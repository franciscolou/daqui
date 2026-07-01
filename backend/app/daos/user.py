from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.user import User


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def create(
    db: Session,
    *,
    name: str,
    email: str,
    hashed_password: str,
    neighborhood: str,
    city: str,
) -> User:
    user = User(
        name=name,
        email=email,
        hashed_password=hashed_password,
        neighborhood=neighborhood,
        city=city,
        badge="morador",
        verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update(db: Session, user: User, data: dict) -> User:
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def get_neighbors(
    db: Session, neighborhood: str, exclude_id: int, limit: int = 50
) -> list[User]:
    return (
        db.query(User)
        .filter(User.neighborhood == neighborhood, User.id != exclude_id)
        .limit(limit)
        .all()
    )


def search(db: Session, query: str, exclude_id: int, limit: int = 30) -> list[User]:
    return (
        db.query(User)
        .filter(User.name.ilike(f"%{query}%"), User.id != exclude_id)
        .order_by(desc(User.posts_count + User.help_count))
        .limit(limit)
        .all()
    )


def get_popular(db: Session, exclude_id: int, limit: int = 10) -> list[User]:
    # Popularidade = engajamento do vizinho (posts + ajudas dadas).
    return (
        db.query(User)
        .filter(User.id != exclude_id)
        .order_by(desc(User.posts_count + User.help_count), desc(User.verified))
        .limit(limit)
        .all()
    )
