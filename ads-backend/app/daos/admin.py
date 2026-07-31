from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.admin import AdAdmin, AdAdminRole


def get_by_email(db: Session, email: str) -> AdAdmin | None:
    return db.query(AdAdmin).filter(AdAdmin.email == email).first()


def get_by_id(db: Session, admin_id: int) -> AdAdmin | None:
    return db.get(AdAdmin, admin_id)


def create(
    db: Session, email: str, hashed_password: str, role: AdAdminRole = AdAdminRole.MODERADOR
) -> AdAdmin:
    admin = AdAdmin(email=email, hashed_password=hashed_password, role=role)
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def list_all(db: Session) -> list[AdAdmin]:
    return db.query(AdAdmin).order_by(desc(AdAdmin.role), AdAdmin.email).all()


def update(db: Session, admin: AdAdmin, data: dict) -> AdAdmin:
    for field, value in data.items():
        setattr(admin, field, value)
    db.commit()
    db.refresh(admin)
    return admin
