from datetime import timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_token_claims
from app.daos import session as session_dao
from app.database import SessionLocal
from app.models.user import StaffRole, User

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
        payload = decode_token_claims(credentials.credentials)
        user_id = int(payload["sub"])
    except (JWTError, ValueError, KeyError):
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

    # Tokens emitidos antes da sessão existir não carregam "jti" — nesse caso não
    # há o que checar (compatibilidade com tokens já em uso). Quando presente,
    # a sessão precisa existir e não ter sido desconectada em "Dispositivos
    # conectados". `current_session_id` fica pendurado no objeto (não persistido)
    # para /auth/sessions saber qual é "este dispositivo" (mesmo padrão de
    # `pending_notice` em UserMe).
    jti = payload.get("jti")
    if jti:
        session = session_dao.get_by_jti(db, jti)
        if not session or session.revoked_at is not None or session.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sessão encerrada. Faça login novamente.",
            )
        user.current_session_id = session.id
    return user


def get_current_moderator(user: User = Depends(get_current_user)) -> User:
    """Restringe o acesso a quem tem qualquer cargo de staff (Moderador,
    Administrador ou Owner) — nome histórico, mantido pelos ~7 controllers de
    moderação que já dependem dele para o trabalho operacional de sempre."""
    if not getattr(user, "is_moderator", False):
        raise HTTPException(status_code=403, detail="Acesso restrito a moderadores")
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    """Restringe a Administrador ou Owner (gestão de contas de Moderador)."""
    if user.staff_role not in (StaffRole.ADMINISTRADOR, StaffRole.OWNER):
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return user


def get_current_owner(user: User = Depends(get_current_user)) -> User:
    """Restringe a Owner (gestão de contas de Administrador; superusuário)."""
    if user.staff_role != StaffRole.OWNER:
        raise HTTPException(status_code=403, detail="Acesso restrito ao owner")
    return user
