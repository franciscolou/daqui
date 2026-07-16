from datetime import datetime, timezone

from fastapi import Body, Depends, File, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin, get_db
from app.models.admin import AdAdmin
from app.schemas.ad import (
    AdOut,
    AdPlanCreate,
    AdPlanOut,
    AdPlanUpdate,
    AnalyticsOut,
    CampaignAdminOut,
    CampaignUpdate,
    CheckoutRequest,
    CheckoutResponse,
    ClickIn,
    CreativeIn,
    CreativeOut,
    CreativeUpdate,
    GlobalAnalyticsOut,
    HasCampaignsOut,
    ManualCampaignCreate,
    ManualCampaignCreateOut,
    MediaUploadOut,
    MyCampaignOut,
    MyCampaignUpdate,
    QuoteRequest,
    QuoteResponse,
)
from app.schemas.settings import AdSettingsOut, AdSettingsUpdate
from app.services import ad as ad_service


def _parse_ids(raw: str | None) -> list[int]:
    if not raw:
        return []
    return [int(x) for x in raw.split(",") if x.strip().isdigit()]


def _parse_csv(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [x.strip() for x in raw.split(",") if x.strip()]


# ── Público (site do anunciante e telas do app Daqui) ──────────────────
def list_plans(db: Session = Depends(get_db)) -> list[AdPlanOut]:
    return ad_service.list_public_plans(db)


def quote(payload: QuoteRequest, db: Session = Depends(get_db)) -> QuoteResponse:
    return ad_service.quote(db, payload)


def checkout(
    payload: CheckoutRequest, db: Session = Depends(get_db)
) -> CheckoutResponse:
    return ad_service.checkout(db, payload)


def upload_media(request: Request, file: UploadFile = File(...)) -> MediaUploadOut:
    # Público (mesmo contexto sem login do checkout self-service) — o time de
    # anúncios também usa este endpoint ao inserir uma campanha manual.
    return ad_service.upload_media(str(request.base_url), file)


async def stripe_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    ad_service.handle_stripe_webhook(db, payload, signature)
    return {"received": True}


def get_active_ad(
    format: str,
    neighborhood: str | None = Query(None),
    nearby_neighborhoods: str | None = Query(None),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
    view_mode: str | None = Query(None),
    category: str | None = Query(None),
    group_ids: str | None = Query(None),
    engagement: str | None = Query(None),
    recency: str | None = Query(None),
    viewer_id: str | None = Query(None),
    db: Session = Depends(get_db),
) -> AdOut | None:
    ctx = {
        "neighborhood": neighborhood,
        "nearby_neighborhoods": _parse_csv(nearby_neighborhoods),
        "lat": lat,
        "lng": lng,
        "view_mode": view_mode,
        "category": category,
        "group_ids": _parse_ids(group_ids),
        "engagement": engagement,
        "recency": recency,
        "viewer_id": viewer_id,
    }
    return ad_service.get_active_ad(db, format, ctx)


def get_active_ad_list(
    format: str,
    neighborhood: str | None = Query(None),
    nearby_neighborhoods: str | None = Query(None),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
    view_mode: str | None = Query(None),
    category: str | None = Query(None),
    group_ids: str | None = Query(None),
    engagement: str | None = Query(None),
    recency: str | None = Query(None),
    viewer_id: str | None = Query(None),
    exclude_ids: str | None = Query(None),
    limit: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
) -> list[AdOut]:
    ctx = {
        "neighborhood": neighborhood,
        "nearby_neighborhoods": _parse_csv(nearby_neighborhoods),
        "lat": lat,
        "lng": lng,
        "view_mode": view_mode,
        "category": category,
        "group_ids": _parse_ids(group_ids),
        "engagement": engagement,
        "recency": recency,
        "viewer_id": viewer_id,
    }
    return ad_service.get_active_ad_list(db, format, ctx, _parse_ids(exclude_ids), limit)


def track_click(
    campaign_id: int,
    payload: ClickIn | None = Body(None),
    db: Session = Depends(get_db),
) -> None:
    ad_service.track_click(db, campaign_id, payload)


def get_my_campaign(
    token: str,
    group_by: str = Query("weekday"),
    db: Session = Depends(get_db),
) -> MyCampaignOut:
    # Público — o token (não uma sessão de admin) é a própria autorização,
    # ver `/anunciar/painel/[token].tsx` no frontend.
    return ad_service.get_my_campaign(db, token, group_by)


def update_my_campaign(
    token: str,
    payload: MyCampaignUpdate,
    db: Session = Depends(get_db),
) -> MyCampaignOut:
    # Público, mesma autorização por token — edição de conteúdo pelo próprio
    # anunciante (ver services::update_my_campaign sobre o que é editável).
    return ad_service.update_my_campaign(db, token, payload)


def get_my_campaigns_exists(
    email: str = Query(...),
    db: Session = Depends(get_db),
) -> HasCampaignsOut:
    # Público — usado pela sidebar do app Daqui (usuário logado) pra decidir
    # entre rotular o item "Meus anúncios" ou "Anuncie conosco". O e-mail vem
    # do próprio usuário autenticado no app, não é um dado sensível de terceiro.
    return ad_service.has_my_campaigns(db, email)


def get_my_campaigns_analytics(
    email: str = Query(...),
    campaign_ids: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: Session = Depends(get_db),
) -> GlobalAnalyticsOut:
    # Público, escopado por e-mail exato (ver services::get_my_campaigns_analytics
    # sobre por que isso é seguro mesmo sem login de anunciante).
    return ad_service.get_my_campaigns_analytics(
        db,
        email,
        campaign_ids=_parse_ids(campaign_ids) if campaign_ids else None,
        date_from=_parse_date(date_from, end_of_day=False),
        date_to=_parse_date(date_to, end_of_day=True),
    )


# ── Admin de anúncios ───────────────────────────────────────────────────
def admin_get_settings(
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> AdSettingsOut:
    return ad_service.admin_get_settings(db)


def admin_update_settings(
    payload: AdSettingsUpdate,
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> AdSettingsOut:
    return ad_service.admin_update_settings(db, payload)


def admin_list_campaigns(
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> list[CampaignAdminOut]:
    return ad_service.admin_list_campaigns(db, status)


def admin_create_manual_campaign(
    payload: ManualCampaignCreate,
    db: Session = Depends(get_db),
    admin: AdAdmin = Depends(get_current_admin),
) -> ManualCampaignCreateOut:
    return ad_service.admin_create_manual_campaign(db, admin, payload)


def admin_mark_campaign_paid(
    campaign_id: int,
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> CampaignAdminOut:
    return ad_service.admin_mark_campaign_paid(db, campaign_id)


def admin_update_campaign(
    campaign_id: int,
    payload: CampaignUpdate,
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> CampaignAdminOut:
    return ad_service.admin_update_campaign(db, campaign_id, payload)


def admin_create_plan(
    payload: AdPlanCreate,
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> AdPlanOut:
    return ad_service.admin_create_plan(db, payload)


def admin_list_plans(
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> list[AdPlanOut]:
    return ad_service.admin_list_plans(db)


def admin_update_plan(
    plan_id: int,
    payload: AdPlanUpdate,
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> AdPlanOut:
    return ad_service.admin_update_plan(db, plan_id, payload)


def admin_delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> None:
    ad_service.admin_delete_plan(db, plan_id)


def admin_list_creatives(
    campaign_id: int,
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> list[CreativeOut]:
    return ad_service.admin_list_creatives(db, campaign_id)


def admin_create_creative(
    campaign_id: int,
    payload: CreativeIn,
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> CreativeOut:
    return ad_service.admin_create_creative(db, campaign_id, payload)


def admin_update_creative(
    campaign_id: int,
    creative_id: int,
    payload: CreativeUpdate,
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> CreativeOut:
    return ad_service.admin_update_creative(db, creative_id, payload)


def admin_get_analytics(
    campaign_id: int,
    group_by: str = Query("hour"),
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> AnalyticsOut:
    return ad_service.admin_get_analytics(db, campaign_id, group_by)


def _parse_date(raw: str | None, *, end_of_day: bool) -> datetime | None:
    """SQLite/SQLAlchemy devolve os `DateTime(timezone=True)` já gravados
    como naive (ver `AdCampaign.paid_at`/`AdEvent.occurred_at`, sempre
    criados com `datetime.now(timezone.utc)` mas lidos sem tzinfo) — por
    isso o filtro também precisa ser naive, senão a comparação em Python
    (fora do SQL) explode com offset-naive vs offset-aware."""
    if not raw:
        return None
    dt = datetime.fromisoformat(raw)
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    if end_of_day and len(raw) <= 10:  # só data (sem horário): cobre o dia inteiro
        dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
    return dt


def admin_get_global_analytics(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    advertiser: str | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    _admin: AdAdmin = Depends(get_current_admin),
) -> GlobalAnalyticsOut:
    return ad_service.admin_get_global_analytics(
        db,
        date_from=_parse_date(date_from, end_of_day=False),
        date_to=_parse_date(date_to, end_of_day=True),
        advertiser=advertiser,
        status=status,
    )
