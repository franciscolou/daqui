from sqlalchemy.orm import Session

from app.models.admin import AdAdmin


def get_by_email(db: Session, email: str) -> AdAdmin | None:
    return db.query(AdAdmin).filter(AdAdmin.email == email).first()


def get_by_id(db: Session, admin_id: int) -> AdAdmin | None:
    return db.get(AdAdmin, admin_id)


def create(db: Session, email: str, hashed_password: str) -> AdAdmin:
    admin = AdAdmin(email=email, hashed_password=hashed_password)
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin
