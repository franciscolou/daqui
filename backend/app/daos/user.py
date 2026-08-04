from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from app.models.user import StaffRole, User, UserBadge


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_by_google_id(db: Session, google_id: str) -> User | None:
    return db.query(User).filter(User.google_id == google_id).first()


def create(
    db: Session,
    *,
    username: str,
    name: str,
    email: str,
    hashed_password: str,
    neighborhood: str,
    city: str,
    state: str = "SP",
    latitude: float | None = None,
    longitude: float | None = None,
    staff_role: StaffRole | None = None,
    verified: bool = False,
    email_verified: bool = False,
    google_id: str | None = None,
    avatar_url: str | None = None,
) -> User:
    user = User(
        username=username,
        name=name,
        email=email,
        hashed_password=hashed_password,
        neighborhood=neighborhood,
        city=city,
        state=state,
        latitude=latitude,
        longitude=longitude,
        badge=UserBadge.LEADER if staff_role else UserBadge.RESIDENT,
        verified=verified,
        staff_role=staff_role,
        email_verified=email_verified,
        google_id=google_id,
        avatar_url=avatar_url,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_staff(db: Session) -> list[User]:
    """Contas de staff (Moderador/Administrador/Owner), ordenadas por cargo (mais alto primeiro)."""
    return (
        db.query(User)
        .filter(User.staff_role.isnot(None))
        .order_by(desc(User.staff_role), User.username)
        .all()
    )


def update(db: Session, user: User, data: dict) -> User:
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def count_by_neighborhood(db: Session, neighborhood: str) -> int:
    return db.query(User).filter(User.neighborhood == neighborhood).count()


def get_neighbors(
    db: Session, neighborhood: str, exclude_id: int, limit: int = 50
) -> list[User]:
    return (
        db.query(User)
        .filter(User.neighborhood == neighborhood, User.id != exclude_id)
        .limit(limit)
        .all()
    )


def search(db: Session, query: str, limit: int = 30) -> list[User]:
    like = f"%{query}%"
    return (
        db.query(User)
        .filter(
            or_(User.name.ilike(like), User.username.ilike(like)),
            User.searchable.is_(True),
        )
        .order_by(desc(User.posts_count + User.comments_count))
        .limit(limit)
        .all()
    )


def count_all(db: Session) -> int:
    return db.query(User).count()


def get_avatar_samples(db: Session, limit: int = 6) -> list[str]:
    """Fotos de perfil reais mais recentes, pra vitrine pré-login (ver
    welcome.tsx/community_stats) — só usuários com avatar_url definido e conta
    ativa, mais recentes primeiro."""
    rows = (
        db.query(User.avatar_url)
        .filter(User.avatar_url.isnot(None), User.is_suspended.is_(False))
        .order_by(desc(User.created_at))
        .limit(limit)
        .all()
    )
    return [r[0] for r in rows]


def get_popular(
    db: Session, neighborhood: str, exclude_id: int, limit: int = 10
) -> list[User]:
    # Popularidade = engajamento do vizinho (posts + comentários), dentro do bairro.
    return (
        db.query(User)
        .filter(User.neighborhood == neighborhood, User.id != exclude_id)
        .order_by(desc(User.posts_count + User.comments_count), desc(User.verified))
        .limit(limit)
        .all()
    )
