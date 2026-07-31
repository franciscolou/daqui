from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_administrator, get_db
from app.models.admin import AdAdmin
from app.schemas.audit_log import AdAuditLogOut
from app.services import audit_log as audit_log_service


# ── Administrador/Owner (painel de anúncios) ─────────────────────────────
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _actor: AdAdmin = Depends(get_current_administrator),
) -> list[AdAuditLogOut]:
    return audit_log_service.admin_list(db, page, page_size)
