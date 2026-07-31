"""
Cria (ou garante) a conta Owner (superusuário) do app de moderação — o bootstrap
da hierarquia de staff (Moderador < Administrador < Owner, ver models/user.py::
StaffRole). Novas contas Moderador/Administrador são criadas pela própria UI
(seção "Equipe" em moderator/index.html), não por seed.
Execute: python -m app.seed_moderator  (idempotente)

Login: moderador@daqui.com / senha123
"""
from app.core.security import hash_password
from app.database import SessionLocal, create_tables
from app.models.user import StaffRole, User, UserBadge

EMAIL = "moderador@daqui.com"
USERNAME = "moderador"
PASSWORD = "senha123"


def seed_moderator():
    create_tables()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == EMAIL).first()
        if user:
            if user.staff_role != StaffRole.OWNER:
                user.staff_role = StaffRole.OWNER
                db.commit()
                print(f"✓ '{EMAIL}' promovido a owner.")
            else:
                print(f"• '{EMAIL}' já é owner, nada a fazer.")
            return

        user = User(
            username=USERNAME,
            # User.name é NOT NULL, mas o ambiente de moderação não usa nome de
            # exibição — o username já é a única identidade exibida.
            name=USERNAME,
            email=EMAIL,
            hashed_password=hash_password(PASSWORD),
            neighborhood="Leme",
            city="Rio de Janeiro",
            state="RJ",
            badge=UserBadge.LEADER,
            verified=True,
            staff_role=StaffRole.OWNER,
            email_verified=True,
        )
        db.add(user)
        db.commit()
        print(f"✅ Owner criado: {EMAIL} / {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_moderator()
