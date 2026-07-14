"""
Cria (ou garante) uma conta de moderador para o app de moderação.
Execute: python -m app.seed_moderator  (idempotente)

Login: moderador@daqui.com / senha123
"""
from app.core.security import hash_password
from app.database import SessionLocal, create_tables
from app.models.user import User

EMAIL = "moderador@daqui.com"
USERNAME = "moderador"
PASSWORD = "senha123"


def seed_moderator():
    create_tables()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == EMAIL).first()
        if user:
            if not user.is_moderator:
                user.is_moderator = True
                db.commit()
                print(f"✓ '{EMAIL}' promovido a moderador.")
            else:
                print(f"• '{EMAIL}' já é moderador, nada a fazer.")
            return

        user = User(
            username=USERNAME,
            name="Moderação Daqui",
            email=EMAIL,
            hashed_password=hash_password(PASSWORD),
            neighborhood="Leme",
            city="Rio de Janeiro",
            state="RJ",
            badge="lider",
            verified=True,
            is_moderator=True,
            email_verified=True,
        )
        db.add(user)
        db.commit()
        print(f"✅ Moderador criado: {EMAIL} / {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_moderator()
