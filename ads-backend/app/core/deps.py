from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.daos import admin as admin_dao
from app.database import SessionLocal
from app.models.admin import AdAdmin, AdAdminRole

bearer = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> AdAdmin:
    """Qualquer AdAdmin autenticado e não suspenso — nome histórico, mantido
    pelos ~15 endpoints do painel que já dependem dele (todos os cargos têm
    paridade operacional total; só a gestão de contas de staff diferencia)."""
    try:
        admin_id = int(decode_token(credentials.credentials))
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        ) from None
    admin = admin_dao.get_by_id(db, admin_id)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado"
        )
    if admin.is_suspended:
        raise HTTPException(status_code=423, detail="Conta suspensa. Fale com um administrador.")
    return admin


def get_current_administrator(admin: AdAdmin = Depends(get_current_admin)) -> AdAdmin:
    """Restringe a Administrador ou Owner (gestão de contas de Moderador)."""
    if admin.role not in (AdAdminRole.ADMINISTRADOR, AdAdminRole.OWNER):
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return admin


def get_current_owner(admin: AdAdmin = Depends(get_current_admin)) -> AdAdmin:
    """Restringe a Owner (gestão de contas de Administrador; superusuário)."""
    if admin.role != AdAdminRole.OWNER:
        raise HTTPException(status_code=403, detail="Acesso restrito ao owner")
    return admin
