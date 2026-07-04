from datetime import timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.database import SessionLocal
from app.models.user import User

bearer = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def suspension_message(user: User) -> str:
    """Mensagem exibida quando a conta está suspensa (login bloqueado ou sessão encerrada)."""
    if user.suspended_until is None:
        return "Sua conta foi suspensa por tempo indeterminado. Entre em contato com o suporte para mais informações."
    until = user.suspended_until
    if until.tzinfo is None:
        until = until.replace(tzinfo=timezone.utc)
    return f"Sua conta está suspensa até {until.strftime('%d/%m/%Y às %H:%M')}."


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    try:
        user_id = int(decode_token(credentials.credentials))
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        )
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if user.is_currently_suspended:
        # 423 Locked: sinal distinto para o app encerrar a sessão na hora com aviso.
        raise HTTPException(status_code=423, detail=suspension_message(user))
    return user


def get_current_moderator(user: User = Depends(get_current_user)) -> User:
    """Restringe o acesso a quem tem papel de moderador (app de moderação)."""
    if not getattr(user, "is_moderator", False):
        raise HTTPException(status_code=403, detail="Acesso restrito a moderadores")
    return user
