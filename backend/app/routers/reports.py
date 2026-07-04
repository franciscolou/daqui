from fastapi import APIRouter

from app.controllers import report
from app.schemas.report import ReportAdminOut, ReportOut, ReportStats

# App Daqui (usuário): denunciar posts, comentários ou perfis.
router = APIRouter(prefix="/reports", tags=["reports"])
router.post("/", response_model=ReportOut, status_code=201)(report.submit_report)

# App de moderação: rotas restritas a moderadores.
admin_router = APIRouter(prefix="/admin/reports", tags=["moderation"])
admin_router.get("/stats", response_model=ReportStats)(report.reports_stats)
admin_router.get("", response_model=list[ReportAdminOut])(report.list_reports)
admin_router.patch("/{report_id}", response_model=ReportAdminOut)(report.set_report_status)
admin_router.delete("/{report_id}", status_code=204)(report.delete_report)
