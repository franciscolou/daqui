from fastapi import APIRouter

from app.controllers import analytics
from app.schemas.analytics import AnalyticsOverviewOut

# App Daqui (usuário): ingestão de telemetria em lote (ver lib/analytics.ts).
router = APIRouter(prefix="/analytics", tags=["analytics"])
router.post("/events", status_code=202)(analytics.ingest_events)

# App de moderação: overview agregado, restrito ao Owner (ver core/deps.get_current_owner).
admin_router = APIRouter(prefix="/admin/analytics", tags=["moderation"])
admin_router.get("/overview", response_model=AnalyticsOverviewOut)(analytics.get_overview)
