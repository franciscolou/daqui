from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core import payments
from app.core.uploads import save_upload_media
from app.daos import ad as ad_dao
from app.daos import settings as settings_dao
from app.models.ad import (
    EVENT_CLICK,
    EVENT_IMPRESSION,
    STATUS_ACTIVE,
    STATUS_PENDING_PAYMENT,
    AdCampaign,
)
from app.models.admin import AdAdmin
from app.schemas.ad import (
    AdOut,
    AdPlanCreate,
    AdPlanOut,
    AdPlanUpdate,
    AnalyticsBucket,
    AnalyticsOut,
    AnalyticsSummary,
    CampaignAdminOut,
    CampaignAnalyticsRow,
    CampaignUpdate,
    CheckoutRequest,
    CheckoutResponse,
    ClickIn,
    CreativeIn,
    CreativeOut,
    CreativeUpdate,
    GlobalAnalyticsOut,
    GlobalAnalyticsSummary,
    HasCampaignsOut,
    ManualCampaignCreate,
    MediaUploadOut,
    MyCampaignOut,
    PriceFactor,
    QuoteRequest,
    QuoteResponse,
    ScheduleIn,
    TargetingIn,
)
from app.schemas.settings import AdSettingsOut, AdSettingsUpdate
from app.services import ad_pricing

WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

FORMAT_LABELS = {
    "post": "Post + mapa",
    "conversation": "Conversa (Mensagens)",
    "notification": "Novidades",
    "search_poster": "Poster de busca",
}


def _fmt_brl(cents: int) -> str:
    s = f"{cents / 100:,.2f}"
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def _check_targeting(targeting: TargetingIn) -> None:
    if not targeting.citywide and not targeting.neighborhoods:
        raise HTTPException(
            status_code=400, detail="Selecione ao menos um bairro ou 'cidade toda'"
        )


def _quote_breakdown(
    db: Session,
    *,
    formats: list[str],
    duration_days: int,
    targeting: TargetingIn,
    schedule: ScheduleIn,
    objective: str,
    priority: int,
    daily_impression_cap: int | None,
    per_user_impression_cap: int | None,
) -> dict:
    competing_count = ad_dao.count_competing_campaigns(
        db, targeting.neighborhoods, targeting.citywide
    )
    return ad_pricing.quote(
        formats=formats,
        duration_days=duration_days,
        targeting=targeting.model_dump(),
        schedule=schedule.model_dump(),
        objective=objective,
        priority=priority,
        daily_impression_cap=daily_impression_cap,
        per_user_impression_cap=per_user_impression_cap,
        competing_count=competing_count,
        market_multiplier=settings_dao.get(db).price_multiplier,
    )


# ── Público (site do anunciante) ───────────────────────────────────────
def list_public_plans(db: Session) -> list[AdPlanOut]:
    # Preço de exibição já com o multiplicador geral aplicado (ver
    # "Configurações" no painel) — o preço base cadastrado no plano continua
    # intacto no banco, só a exibição/cobrança final escala com o mercado.
    multiplier = settings_dao.get(db).price_multiplier
    plans = []
    for p in ad_dao.list_public_plans(db):
        out = AdPlanOut.model_validate(p)
        plans.append(out.model_copy(update={"price_cents": round(p.price_cents * multiplier)}))
    return plans


def quote(db: Session, payload: QuoteRequest) -> QuoteResponse:
    targeting = payload.effective_targeting()
    _check_targeting(targeting)
    schedule = payload.schedule or ScheduleIn()
    result = _quote_breakdown(
        db,
        formats=payload.formats,
        duration_days=payload.duration_days,
        targeting=targeting,
        schedule=schedule,
        objective=payload.objective,
        priority=payload.priority,
        daily_impression_cap=payload.daily_impression_cap,
        per_user_impression_cap=payload.per_user_impression_cap,
    )
    return QuoteResponse(
        price_cents=result["price_cents"],
        base_cents=result["base_cents"],
        factors=[
            PriceFactor(label=label, multiplier=m) for label, m in result["factors"]
        ],
    )


def upload_media(base_url: str, file: UploadFile) -> MediaUploadOut:
    url, media_type = save_upload_media(base_url, file, prefix="ad")
    return MediaUploadOut(url=url, type=media_type)


def checkout(db: Session, payload: CheckoutRequest) -> CheckoutResponse:
    targeting = payload.effective_targeting()
    _check_targeting(targeting)
    schedule = payload.schedule or ScheduleIn()
    result = _quote_breakdown(
        db,
        formats=payload.formats,
        duration_days=payload.duration_days,
        targeting=targeting,
        schedule=schedule,
        objective=payload.objective,
        priority=payload.priority,
        daily_impression_cap=payload.daily_impression_cap,
        per_user_impression_cap=payload.per_user_impression_cap,
    )
    price_cents = result["price_cents"]
    creatives = [c.model_dump() for c in payload.effective_creatives()]
    campaign = ad_dao.create_campaign(
        db,
        creatives=creatives,
        plan_id=payload.plan_id,
        status=STATUS_PENDING_PAYMENT,
        advertiser_name=payload.advertiser_name,
        advertiser_email=payload.advertiser_email,
        advertiser_phone=payload.advertiser_phone,
        formats=payload.formats,
        price_cents=price_cents,
        targeting=targeting.model_dump(),
        duration_days=payload.duration_days,
        objective=payload.objective,
        priority=payload.priority,
        rotation_weight=payload.rotation_weight,
        daily_impression_cap=payload.daily_impression_cap,
        per_user_impression_cap=payload.per_user_impression_cap,
        pacing=payload.pacing,
        schedule=schedule.model_dump(),
        payment_provider="stripe",
    )
    title = campaign.creatives[0].title if campaign.creatives else "Anúncio"
    checkout_url = payments.create_checkout_session(
        campaign.id, campaign.access_token, title, price_cents, campaign.currency
    )
    return CheckoutResponse(campaign_id=campaign.id, checkout_url=checkout_url)


def _activate(db: Session, campaign: AdCampaign, payment_reference: str | None) -> None:
    now = datetime.now(timezone.utc)
    ad_dao.update_campaign(
        db,
        campaign,
        status=STATUS_ACTIVE,
        starts_at=now,
        ends_at=now + timedelta(days=campaign.duration_days),
        paid_at=now,
        payment_reference=payment_reference,
    )


def handle_stripe_webhook(db: Session, payload: bytes, signature: str) -> None:
    event = payments.verify_webhook(payload, signature)
    if event["type"] != "checkout.session.completed":
        return
    session = event["data"]["object"]
    campaign_id = int(session["metadata"]["campaign_id"])
    campaign = ad_dao.get_campaign(db, campaign_id)
    if campaign and campaign.status == STATUS_PENDING_PAYMENT:
        _activate(db, campaign, session.get("id"))


def get_active_ad(db: Session, format: str, ctx: dict) -> AdOut | None:
    campaign = ad_dao.get_active_for_format(db, format, ctx)
    if not campaign:
        return None
    creative = ad_dao.pick_creative(campaign, format)
    if not creative:
        return None
    ad_dao.log_event(
        db,
        campaign=campaign,
        creative=creative,
        event_type=EVENT_IMPRESSION,
        format=format,
        neighborhood=ctx.get("neighborhood"),
        viewer_id=ctx.get("viewer_id"),
    )
    return AdOut(
        id=campaign.id,
        creative_id=creative.id,
        objective=campaign.objective,
        title=creative.title,
        content=creative.content,
        image_url=creative.image_url,
        video_url=creative.video_url,
        cta_label=creative.cta_label,
        target_url=creative.target_url,
        latitude=creative.latitude,
        longitude=creative.longitude,
    )


def track_click(db: Session, campaign_id: int, payload: ClickIn | None) -> None:
    campaign = ad_dao.get_campaign(db, campaign_id)
    if not campaign:
        return
    payload = payload or ClickIn()
    creative = None
    if payload.creative_id is not None:
        creative = ad_dao.get_creative(db, payload.creative_id)
    ad_dao.log_event(
        db,
        campaign=campaign,
        creative=creative,
        event_type=EVENT_CLICK,
        format=payload.format or "",
        neighborhood=None,
        viewer_id=payload.viewer_id,
        objective_action=payload.objective_action,
    )


# ── Admin de anúncios ───────────────────────────────────────────────────
def admin_get_settings(db: Session) -> AdSettingsOut:
    return AdSettingsOut.model_validate(settings_dao.get(db))


def admin_update_settings(db: Session, payload: AdSettingsUpdate) -> AdSettingsOut:
    current = settings_dao.get(db)
    updated = settings_dao.update(db, current, **payload.model_dump())
    return AdSettingsOut.model_validate(updated)


def admin_create_plan(db: Session, payload: AdPlanCreate) -> AdPlanOut:
    plan = ad_dao.create_plan(db, **payload.model_dump())
    return AdPlanOut.model_validate(plan)


def admin_list_plans(db: Session) -> list[AdPlanOut]:
    return [AdPlanOut.model_validate(p) for p in ad_dao.list_all_plans(db)]


def admin_update_plan(db: Session, plan_id: int, payload: AdPlanUpdate) -> AdPlanOut:
    plan = ad_dao.get_plan(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    plan = ad_dao.update_plan(db, plan, **fields)
    return AdPlanOut.model_validate(plan)


def admin_delete_plan(db: Session, plan_id: int) -> None:
    plan = ad_dao.get_plan(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    ad_dao.delete_plan(db, plan)


def admin_list_campaigns(db: Session, status: str | None) -> list[CampaignAdminOut]:
    return [
        CampaignAdminOut.model_validate(c) for c in ad_dao.list_campaigns(db, status)
    ]


def admin_create_manual_campaign(
    db: Session, admin: AdAdmin, payload: ManualCampaignCreate
) -> CampaignAdminOut:
    targeting = payload.effective_targeting()
    _check_targeting(targeting)
    schedule = payload.schedule or ScheduleIn()
    starts_at = payload.starts_at or datetime.now(timezone.utc)
    creatives = [c.model_dump() for c in payload.effective_creatives()]
    campaign = ad_dao.create_campaign(
        db,
        creatives=creatives,
        plan_id=payload.plan_id,
        status=STATUS_ACTIVE,
        advertiser_name=payload.advertiser_name,
        advertiser_email=payload.advertiser_email,
        advertiser_phone=payload.advertiser_phone,
        formats=payload.formats,
        price_cents=payload.price_cents,
        targeting=targeting.model_dump(),
        duration_days=payload.duration_days,
        objective=payload.objective,
        priority=payload.priority,
        rotation_weight=payload.rotation_weight,
        daily_impression_cap=payload.daily_impression_cap,
        per_user_impression_cap=payload.per_user_impression_cap,
        pacing=payload.pacing,
        schedule=schedule.model_dump(),
        starts_at=starts_at,
        ends_at=starts_at + timedelta(days=payload.duration_days),
        created_by_admin_id=admin.id,
        payment_provider="manual",
        paid_at=starts_at,
    )
    return CampaignAdminOut.model_validate(campaign)


def admin_update_campaign(
    db: Session, campaign_id: int, payload: CampaignUpdate
) -> CampaignAdminOut:
    campaign = ad_dao.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    campaign = ad_dao.update_campaign(db, campaign, **fields)
    return CampaignAdminOut.model_validate(campaign)


def admin_list_creatives(db: Session, campaign_id: int) -> list[CreativeOut]:
    return [
        CreativeOut.model_validate(c) for c in ad_dao.list_creatives(db, campaign_id)
    ]


def admin_create_creative(
    db: Session, campaign_id: int, payload: CreativeIn
) -> CreativeOut:
    if not ad_dao.get_campaign(db, campaign_id):
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    creative = ad_dao.create_creative(db, campaign_id, **payload.model_dump())
    return CreativeOut.model_validate(creative)


def admin_update_creative(
    db: Session, creative_id: int, payload: CreativeUpdate
) -> CreativeOut:
    creative = ad_dao.get_creative(db, creative_id)
    if not creative:
        raise HTTPException(status_code=404, detail="Criativo não encontrado")
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    creative = ad_dao.update_creative(db, creative, **fields)
    return CreativeOut.model_validate(creative)


def _campaign_analytics(db: Session, campaign: AdCampaign, group_by: str) -> AnalyticsOut:
    events = ad_dao.list_events(db, campaign.id)
    impressions = [e for e in events if e.event_type == EVENT_IMPRESSION]
    clicks = [e for e in events if e.event_type == EVENT_CLICK]
    n_imp, n_clk = len(impressions), len(clicks)

    summary = AnalyticsSummary(
        impressions=n_imp,
        clicks=n_clk,
        ctr=(n_clk / n_imp) if n_imp else 0.0,
        cpc_cents=(campaign.price_cents / n_clk) if n_clk else None,
        cpm_cents=(campaign.price_cents / (n_imp / 1000)) if n_imp else None,
    )

    imp_by: dict = defaultdict(int)
    clk_by: dict = defaultdict(int)
    if group_by == "hour":
        for e in impressions:
            imp_by[e.occurred_at.hour] += 1
        for e in clicks:
            clk_by[e.occurred_at.hour] += 1
        keys = sorted(set(imp_by) | set(clk_by))
        labels = {h: f"{h:02d}h" for h in keys}
    elif group_by == "weekday":
        for e in impressions:
            imp_by[e.occurred_at.weekday()] += 1
        for e in clicks:
            clk_by[e.occurred_at.weekday()] += 1
        keys = sorted(set(imp_by) | set(clk_by))
        labels = {d: WEEKDAY_LABELS[d] for d in keys}
    else:  # neighborhood
        for e in impressions:
            if e.neighborhood:
                imp_by[e.neighborhood] += 1
        for e in clicks:
            if e.neighborhood:
                clk_by[e.neighborhood] += 1
        keys = sorted(set(imp_by) | set(clk_by))
        labels = {n: n for n in keys}

    buckets = [
        AnalyticsBucket(
            key=labels[k],
            impressions=imp_by[k],
            clicks=clk_by[k],
            ctr=(clk_by[k] / imp_by[k]) if imp_by[k] else 0.0,
        )
        for k in keys
    ]

    actions: dict = defaultdict(int)
    for e in clicks:
        if e.objective_action:
            actions[e.objective_action] += 1

    return AnalyticsOut(summary=summary, buckets=buckets, actions=dict(actions))


def admin_get_analytics(db: Session, campaign_id: int, group_by: str) -> AnalyticsOut:
    campaign = ad_dao.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    return _campaign_analytics(db, campaign, group_by)


# ── Painel do anunciante (público, capability token) ────────────────────
def get_my_campaign(db: Session, token: str, group_by: str) -> MyCampaignOut:
    campaign = ad_dao.get_campaign_by_token(db, token)
    if not campaign:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    analytics = _campaign_analytics(db, campaign, group_by)
    return MyCampaignOut(
        id=campaign.id,
        status=campaign.status,
        advertiser_name=campaign.advertiser_name,
        formats=campaign.formats,
        price_cents=campaign.price_cents,
        currency=campaign.currency,
        targeting=campaign.targeting,
        duration_days=campaign.duration_days,
        starts_at=campaign.starts_at,
        ends_at=campaign.ends_at,
        created_at=campaign.created_at,
        creatives=[CreativeOut.model_validate(c) for c in campaign.creatives],
        analytics=analytics,
    )


def admin_get_global_analytics(
    db: Session,
    *,
    date_from: datetime | None,
    date_to: datetime | None,
    advertiser: str | None,
    status: str | None,
) -> GlobalAnalyticsOut:
    """Visão consolidada pro time de anúncios: todas as campanhas (filtráveis
    por anunciante/status), eventos escopados ao intervalo de datas — mesma
    fonte de verdade (`AdEvent`) do analytics por campanha, só que agregada.
    """
    campaigns = ad_dao.list_campaigns_filtered(db, advertiser=advertiser, status=status)
    return _campaigns_analytics(db, campaigns, date_from=date_from, date_to=date_to)


# ── "Meus anúncios" (dentro do app Daqui, sidebar) ──────────────────────
def has_my_campaigns(db: Session, email: str) -> HasCampaignsOut:
    return HasCampaignsOut(has_campaigns=ad_dao.count_campaigns_by_email(db, email) > 0)


def get_my_campaigns_analytics(
    db: Session,
    email: str,
    *,
    campaign_ids: list[int] | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> GlobalAnalyticsOut:
    """Mesmo motor de `admin_get_global_analytics`, mas escopado às campanhas
    do próprio anunciante logado no Daqui — a igualdade exata de e-mail (não
    um `campaign_ids` cru vindo do cliente) é o que garante que ninguém veja
    analytics de campanha alheia: mesmo que `campaign_ids` seja adulterado,
    o filtro final é sempre a interseção com as campanhas do próprio e-mail."""
    owned = ad_dao.list_campaigns_by_email(db, email)
    if campaign_ids is not None:
        wanted = set(campaign_ids)
        owned = [c for c in owned if c.id in wanted]
    return _campaigns_analytics(db, owned, date_from=date_from, date_to=date_to)


def _campaigns_analytics(
    db: Session,
    campaigns: list[AdCampaign],
    *,
    date_from: datetime | None,
    date_to: datetime | None,
) -> GlobalAnalyticsOut:
    campaign_ids = [c.id for c in campaigns]
    campaigns_by_id = {c.id: c for c in campaigns}
    events = ad_dao.list_events_for_campaigns(db, campaign_ids, date_from, date_to)

    impressions = [e for e in events if e.event_type == EVENT_IMPRESSION]
    clicks = [e for e in events if e.event_type == EVENT_CLICK]
    n_imp, n_clk = len(impressions), len(clicks)

    def in_range(dt: datetime | None) -> bool:
        if dt is None:
            return False
        if date_from and dt < date_from:
            return False
        if date_to and dt > date_to:
            return False
        return True

    # Receita reconhecida na data de pagamento (`paid_at`) — propostas ainda
    # `pending_payment` não geraram receita de verdade.
    revenue_cents = sum(c.price_cents for c in campaigns if in_range(c.paid_at))

    summary = GlobalAnalyticsSummary(
        campaigns_count=len(campaigns),
        active_campaigns=sum(1 for c in campaigns if c.status == STATUS_ACTIVE),
        impressions=n_imp,
        clicks=n_clk,
        ctr=(n_clk / n_imp) if n_imp else 0.0,
        revenue_cents=revenue_cents,
        cpc_cents=(revenue_cents / n_clk) if n_clk and revenue_cents else None,
        cpm_cents=(revenue_cents / (n_imp / 1000)) if n_imp and revenue_cents else None,
    )

    imp_by_campaign: dict = defaultdict(int)
    clk_by_campaign: dict = defaultdict(int)
    imp_by_day: dict = defaultdict(int)
    clk_by_day: dict = defaultdict(int)
    imp_by_format: dict = defaultdict(int)
    clk_by_format: dict = defaultdict(int)
    imp_by_objective: dict = defaultdict(int)
    clk_by_objective: dict = defaultdict(int)
    imp_by_hood: dict = defaultdict(int)

    for e in impressions:
        imp_by_campaign[e.campaign_id] += 1
        imp_by_day[e.occurred_at.date().isoformat()] += 1
        imp_by_format[e.format or "—"] += 1
        camp = campaigns_by_id.get(e.campaign_id)
        if camp:
            imp_by_objective[camp.objective] += 1
        if e.neighborhood:
            imp_by_hood[e.neighborhood] += 1
    for e in clicks:
        clk_by_campaign[e.campaign_id] += 1
        clk_by_day[e.occurred_at.date().isoformat()] += 1
        clk_by_format[e.format or "—"] += 1
        camp = campaigns_by_id.get(e.campaign_id)
        if camp:
            clk_by_objective[camp.objective] += 1

    def bucket_list(imp_map: dict, clk_map: dict, keys: list) -> list[AnalyticsBucket]:
        return [
            AnalyticsBucket(
                key=k,
                impressions=imp_map[k],
                clicks=clk_map[k],
                ctr=(clk_map[k] / imp_map[k]) if imp_map[k] else 0.0,
            )
            for k in keys
        ]

    days = sorted(set(imp_by_day) | set(clk_by_day))
    timeseries = bucket_list(imp_by_day, clk_by_day, days)

    formats = sorted(set(imp_by_format) | set(clk_by_format))
    by_format = bucket_list(imp_by_format, clk_by_format, formats)

    objectives = sorted(set(imp_by_objective) | set(clk_by_objective))
    by_objective = bucket_list(imp_by_objective, clk_by_objective, objectives)

    plan_cache: dict = {}

    def category_of(c: AdCampaign) -> str:
        if not c.plan_id:
            return "personalizado"
        if c.plan_id not in plan_cache:
            plan_cache[c.plan_id] = ad_dao.get_plan(db, c.plan_id)
        plan = plan_cache[c.plan_id]
        return plan.category if plan and plan.category else "personalizado"

    imp_by_category: dict = defaultdict(int)
    clk_by_category: dict = defaultdict(int)
    for e in impressions:
        camp = campaigns_by_id.get(e.campaign_id)
        if camp:
            imp_by_category[category_of(camp)] += 1
    for e in clicks:
        camp = campaigns_by_id.get(e.campaign_id)
        if camp:
            clk_by_category[category_of(camp)] += 1
    categories = sorted(set(imp_by_category) | set(clk_by_category))
    by_category = bucket_list(imp_by_category, clk_by_category, categories)

    top_hoods = sorted(imp_by_hood.items(), key=lambda kv: kv[1], reverse=True)[:8]
    top_neighborhoods = [
        AnalyticsBucket(key=k, impressions=v, clicks=0, ctr=0.0) for k, v in top_hoods
    ]

    rows = [
        CampaignAnalyticsRow(
            id=c.id,
            access_token=c.access_token,
            title=c.creatives[0].title if c.creatives else "Anúncio",
            advertiser_name=c.advertiser_name,
            advertiser_email=c.advertiser_email,
            status=c.status,
            objective=c.objective,
            category=category_of(c),
            formats=c.formats,
            price_cents=c.price_cents,
            impressions=imp_by_campaign.get(c.id, 0),
            clicks=clk_by_campaign.get(c.id, 0),
            ctr=(
                clk_by_campaign.get(c.id, 0) / imp_by_campaign[c.id]
                if imp_by_campaign.get(c.id)
                else 0.0
            ),
            cpc_cents=(
                c.price_cents / clk_by_campaign[c.id]
                if clk_by_campaign.get(c.id)
                else None
            ),
            starts_at=c.starts_at,
            ends_at=c.ends_at,
            created_at=c.created_at,
        )
        for c in campaigns
    ]
    rows.sort(key=lambda r: r.impressions, reverse=True)

    insights: list[str] = []
    scored_formats = [b for b in by_format if b.impressions > 0]
    if scored_formats:
        best_format = max(scored_formats, key=lambda b: b.ctr)
        insights.append(
            f"Formato com melhor CTR: {FORMAT_LABELS.get(best_format.key, best_format.key)} "
            f"({best_format.ctr:.1%})"
        )
    if top_neighborhoods:
        insights.append(
            f"Bairro com mais impressões: {top_neighborhoods[0].key} "
            f"({top_neighborhoods[0].impressions})"
        )
    if rows:
        top_revenue = max(rows, key=lambda r: r.price_cents)
        insights.append(
            f"Maior campanha por valor: {top_revenue.title} — "
            f"{_fmt_brl(top_revenue.price_cents)}"
        )
        scored_rows = [r for r in rows if r.impressions >= 10]
        if scored_rows:
            top_ctr_row = max(scored_rows, key=lambda r: r.ctr)
            insights.append(
                f"Melhor CTR entre campanhas com volume: {top_ctr_row.title} "
                f"({top_ctr_row.ctr:.1%})"
            )
    if summary.active_campaigns == 0:
        insights.append("Nenhuma campanha ativa no momento.")

    return GlobalAnalyticsOut(
        date_from=date_from,
        date_to=date_to,
        summary=summary,
        timeseries=timeseries,
        by_format=by_format,
        by_objective=by_objective,
        by_category=by_category,
        top_neighborhoods=top_neighborhoods,
        campaigns=rows,
        advertisers=ad_dao.list_distinct_advertisers(db),
        insights=insights,
    )
