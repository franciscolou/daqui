from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_moderator, get_db
from app.models.user import User
from app.schemas.audit_log import AuditLogOut
from app.services import audit_log as audit_log_service


# ── Moderador (app de moderação) ──────────────────────────────────────
def list_audit_logs(
    moderator: str | None = Query(None, description="Filtra pelo nome/@usuário do moderador"),
    target_user: str | None = Query(None, description="Filtra pelo nome/@usuário do usuário afetado"),
    action: str | None = Query(None, description="Filtra pelo tipo de ação"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> list[AuditLogOut]:
    return audit_log_service.admin_list(db, moderator, target_user, action, page, page_size)
