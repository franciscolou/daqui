"""Cria (ou garante) a conta inicial do time de anúncios.
Execute: python -m app.seed_admin  (idempotente)
"""

from app.core.config import settings
from app.core.security import hash_password
from app.daos import admin as admin_dao
from app.database import SessionLocal, create_tables


def seed_admin():
    create_tables()
    db = SessionLocal()
    try:
        existing = admin_dao.get_by_email(db, settings.ADS_ADMIN_EMAIL)
        if existing:
            print(f"• '{settings.ADS_ADMIN_EMAIL}' já existe, nada a fazer.")
            return
        admin_dao.create(
            db, settings.ADS_ADMIN_EMAIL, hash_password(settings.ADS_ADMIN_PASSWORD)
        )
        print(
            f"✅ Admin de anúncios criado: {settings.ADS_ADMIN_EMAIL} / {settings.ADS_ADMIN_PASSWORD}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
