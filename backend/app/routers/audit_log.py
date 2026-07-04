from fastapi import APIRouter

from app.controllers import audit_log
from app.schemas.audit_log import AuditLogOut

# App de moderação: registro de auditoria (rotas restritas a moderadores).
admin_router = APIRouter(prefix="/admin/audit-logs", tags=["moderation"])
admin_router.get("", response_model=list[AuditLogOut])(audit_log.list_audit_logs)
