from fastapi import APIRouter

from app.controllers import ad
from app.schemas.ad import (
    AdOut,
    AdPlanOut,
    AnalyticsOut,
    CampaignAdminOut,
    CheckoutResponse,
    CreativeOut,
    GlobalAnalyticsOut,
    MediaUploadOut,
    MyCampaignOut,
    QuoteResponse,
)
from app.schemas.settings import AdSettingsOut

# Público: site do anunciante (planos/quote/checkout) e telas do app Daqui
# (servir/clicar num anúncio ativo).
router = APIRouter(prefix="/ads", tags=["ads"])
router.get("/plans", response_model=list[AdPlanOut])(ad.list_plans)
router.post("/quote", response_model=QuoteResponse)(ad.quote)
router.post("/checkout", response_model=CheckoutResponse)(ad.checkout)
router.post("/media", response_model=MediaUploadOut, status_code=201)(ad.upload_media)
router.post("/webhook/stripe")(ad.stripe_webhook)
router.get("/active/{format}", response_model=AdOut | None)(ad.get_active_ad)
# Painel do anunciante (link com token, ver /anunciar/painel/[token].tsx) —
# rota estática ("my-campaign") declarada antes de "/{campaign_id}/click".
router.get("/my-campaign/{token}", response_model=MyCampaignOut)(ad.get_my_campaign)
router.post("/{campaign_id}/click", status_code=204)(ad.track_click)

# Painel de anúncios (ads-admin/): gerido pelo time interno, autenticado
# via /auth/login deste mesmo serviço (get_current_admin), sem relação com
# o backend/moderador do Daqui.
admin_router = APIRouter(prefix="/admin/ads", tags=["ads-admin"])
admin_router.get("/settings", response_model=AdSettingsOut)(ad.admin_get_settings)
admin_router.put("/settings", response_model=AdSettingsOut)(ad.admin_update_settings)
admin_router.get("/campaigns", response_model=list[CampaignAdminOut])(
    ad.admin_list_campaigns
)
admin_router.post("/campaigns", response_model=CampaignAdminOut, status_code=201)(
    ad.admin_create_manual_campaign
)
admin_router.patch("/campaigns/{campaign_id}", response_model=CampaignAdminOut)(
    ad.admin_update_campaign
)
admin_router.get("/campaigns/{campaign_id}/analytics", response_model=AnalyticsOut)(
    ad.admin_get_analytics
)
admin_router.get("/analytics", response_model=GlobalAnalyticsOut)(
    ad.admin_get_global_analytics
)
admin_router.get(
    "/campaigns/{campaign_id}/creatives", response_model=list[CreativeOut]
)(ad.admin_list_creatives)
admin_router.post(
    "/campaigns/{campaign_id}/creatives",
    response_model=CreativeOut,
    status_code=201,
)(ad.admin_create_creative)
admin_router.patch(
    "/campaigns/{campaign_id}/creatives/{creative_id}", response_model=CreativeOut
)(ad.admin_update_creative)
admin_router.get("/plans", response_model=list[AdPlanOut])(ad.admin_list_plans)
admin_router.post("/plans", response_model=AdPlanOut, status_code=201)(
    ad.admin_create_plan
)
admin_router.patch("/plans/{plan_id}", response_model=AdPlanOut)(ad.admin_update_plan)
admin_router.delete("/plans/{plan_id}", status_code=204)(ad.admin_delete_plan)
