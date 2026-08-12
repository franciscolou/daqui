"""
Cria (ou garante) contas de teste de Administrador e Moderador — o Owner já é
seedado por seed_moderator.py. Útil pra testar a hierarquia de cargos
(Moderador < Administrador < Owner) sem precisar criar contas pela própria UI.
Execute: python -m app.seed_staff  (idempotente)
"""
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.user import StaffRole, User, UserBadge

PASSWORD = "senha123"
ACCOUNTS = [
    dict(email="administrador@daqui.com", username="administrador", role=StaffRole.ADMINISTRADOR),
    dict(email="moderador.teste@daqui.com", username="moderador.teste", role=StaffRole.MODERADOR),
]


def seed_staff():
    db = SessionLocal()
    try:
        for acc in ACCOUNTS:
            user = db.query(User).filter(User.email == acc["email"]).first()
            if user:
                if user.staff_role != acc["role"]:
                    user.staff_role = acc["role"]
                    db.commit()
                    print(f"✓ '{acc['email']}' promovido a {acc['role']}.")
                else:
                    print(f"• '{acc['email']}' já é {acc['role']}, nada a fazer.")
                continue
            user = User(
                username=acc["username"],
                # User.name é NOT NULL, mas o ambiente de moderação não usa nome
                # de exibição — o username já é a única identidade exibida.
                name=acc["username"],
                email=acc["email"],
                hashed_password=hash_password(PASSWORD),
                neighborhood="",
                city="São Paulo",
                state="SP",
                badge=UserBadge.LEADER,
                verified=True,
                staff_role=acc["role"],
                email_verified=True,
            )
            db.add(user)
            db.commit()
            print(f"✅ {acc['role']} criado: {acc['email']} / {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_staff()
