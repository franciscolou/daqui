"""
Cria (ou garante) contas de teste de Administrador e Moderador — o Owner já é
seedado por seed_ads_admin.py. Útil pra testar a hierarquia de cargos
(Moderador < Administrador < Owner) sem precisar criar contas pela própria UI.
Execute: python -m app.seed_ads_staff  (idempotente)
"""
from app.core.security import hash_password
from app.core.username import suggest_from_email
from app.daos import ad_admin as admin_dao
from app.database import SessionLocal, create_tables
from app.models.ad_admin import AdAdminRole

PASSWORD = "senha123"
ACCOUNTS = [
    ("administrador.ads@daqui.com", AdAdminRole.ADMINISTRADOR),
    ("moderador.ads@daqui.com", AdAdminRole.MODERADOR),
]


def seed_staff():
    create_tables()
    db = SessionLocal()
    try:
        for email, role in ACCOUNTS:
            existing = admin_dao.get_by_email(db, email)
            if existing:
                if existing.role != role:
                    admin_dao.update(db, existing, {"role": role})
                    print(f"✓ '{email}' promovido a {role}.")
                else:
                    print(f"• '{email}' já é {role}, nada a fazer.")
                continue
            admin_dao.create(db, email, suggest_from_email(email), hash_password(PASSWORD), role=role)
            print(f"✅ {role} criado: {email} / {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_staff()
