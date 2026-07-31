from fastapi import APIRouter

from app.controllers import audit_log
from app.schemas.audit_log import AdAuditLogOut

# Painel de anúncios: registro de auditoria (gestão de contas de staff),
# restrito a Administrador/Owner (ver core/deps.py::get_current_administrator).
admin_router = APIRouter(prefix="/admin/audit-logs", tags=["ads-admin"])
admin_router.get("", response_model=list[AdAuditLogOut])(audit_log.list_audit_logs)
