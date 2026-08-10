from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_ads_administrator, get_db
from app.models.ad_admin import AdAdmin
from app.models.ad_audit_log import AdAuditLogAction
from app.schemas.ad_audit_log import AdAuditLogOut
from app.services import ad_audit_log as audit_log_service


# ── Administrador/Owner (painel de anúncios) ─────────────────────────────
def list_audit_logs(
    actor: str | None = Query(None),
    action: list[AdAuditLogAction] | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _actor_admin: AdAdmin = Depends(get_current_ads_administrator),
) -> list[AdAuditLogOut]:
    return audit_log_service.admin_list(db, actor, action, page, page_size)
