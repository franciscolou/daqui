"""Cria (ou garante) a conta Owner (superusuário) do time de anúncios — o
bootstrap da hierarquia de staff (Moderador < Administrador < Owner, ver
models/ad_admin.py::AdAdminRole). Novas contas Moderador/Administrador são
criadas pela própria UI (seção "Equipe" em ads-admin/index.html), não por seed.
Execute: python -m app.seed_ads_admin  (idempotente)
"""

from app.core.config import settings
from app.core.security import hash_password
from app.core.username import suggest_from_email
from app.daos import ad_admin as admin_dao
from app.database import SessionLocal, create_tables
from app.models.ad_admin import AdAdminRole


def seed_admin():
    create_tables()
    db = SessionLocal()
    try:
        existing = admin_dao.get_by_email(db, settings.ADS_ADMIN_EMAIL)
        if existing:
            if existing.role != AdAdminRole.OWNER:
                admin_dao.update(db, existing, {"role": AdAdminRole.OWNER})
                print(f"✓ '{settings.ADS_ADMIN_EMAIL}' promovido a owner.")
            else:
                print(f"• '{settings.ADS_ADMIN_EMAIL}' já é owner, nada a fazer.")
            return
        admin_dao.create(
            db,
            settings.ADS_ADMIN_EMAIL,
            suggest_from_email(settings.ADS_ADMIN_EMAIL),
            hash_password(settings.ADS_ADMIN_PASSWORD),
            role=AdAdminRole.OWNER,
        )
        print(
            f"✅ Owner de anúncios criado: {settings.ADS_ADMIN_EMAIL} / {settings.ADS_ADMIN_PASSWORD}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
