import math
import random
from datetime import datetime, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.ad import (
    EVENT_IMPRESSION,
    STATUS_ACTIVE,
    STATUS_PENDING_PAYMENT,
    AdCampaign,
    AdCreative,
    AdEvent,
    AdPlan,
)


# ── Planos ───────────────────────────────────────────────────────────────
def list_public_plans(db: Session) -> list[AdPlan]:
    return (
        db.query(AdPlan)
        .filter(AdPlan.is_public.is_(True))
        .order_by(AdPlan.sort_order)
        .all()
    )


def list_all_plans(db: Session) -> list[AdPlan]:
    return db.query(AdPlan).order_by(AdPlan.sort_order).all()


def get_plan(db: Session, plan_id: int) -> AdPlan | None:
    return db.get(AdPlan, plan_id)


def create_plan(db: Session, **fields) -> AdPlan:
    plan = AdPlan(**fields)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def get_plan_by_slug(db: Session, slug: str) -> AdPlan | None:
    return db.query(AdPlan).filter(AdPlan.slug == slug).first()


def update_plan(db: Session, plan: AdPlan, **fields) -> AdPlan:
    for key, value in fields.items():
        setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return plan


def delete_plan(db: Session, plan: AdPlan) -> None:
    db.delete(plan)
    db.commit()


# ── Campanhas ────────────────────────────────────────────────────────────
def create_campaign(db: Session, *, creatives: list[dict], **fields) -> AdCampaign:
    campaign = AdCampaign(**fields)
    db.add(campaign)
    db.flush()  # garante campaign.id antes de criar os criativos filhos
    for creative_fields in creatives:
        db.add(AdCreative(campaign_id=campaign.id, **creative_fields))
    db.commit()
    db.refresh(campaign)
    return campaign


def get_campaign(db: Session, campaign_id: int) -> AdCampaign | None:
    return db.get(AdCampaign, campaign_id)


def get_campaign_by_token(db: Session, token: str) -> AdCampaign | None:
    return db.query(AdCampaign).filter(AdCampaign.access_token == token).first()


def list_campaigns(db: Session, status: str | None = None) -> list[AdCampaign]:
    q = db.query(AdCampaign)
    if status:
        q = q.filter(AdCampaign.status == status)
    return q.order_by(AdCampaign.created_at.desc()).all()


def update_campaign(db: Session, campaign: AdCampaign, **fields) -> AdCampaign:
    for key, value in fields.items():
        setattr(campaign, key, value)
    db.commit()
    db.refresh(campaign)
    return campaign


def count_competing_campaigns(
    db: Session, neighborhoods: list[str], citywide: bool
) -> int:
    """Quantas campanhas ativas/pendentes já disputam a mesma audiência —
    usado só pelo fator `competition_multiplier` da precificação."""
    candidates = (
        db.query(AdCampaign)
        .filter(AdCampaign.status.in_([STATUS_ACTIVE, STATUS_PENDING_PAYMENT]))
        .all()
    )
    wanted = set(neighborhoods)
    count = 0
    for c in candidates:
        if citywide or c.citywide:
            count += 1
        elif wanted & set(c.neighborhoods):
            count += 1
    return count


# ── Criativos ────────────────────────────────────────────────────────────
def list_creatives(db: Session, campaign_id: int) -> list[AdCreative]:
    return db.query(AdCreative).filter(AdCreative.campaign_id == campaign_id).all()


def get_creative(db: Session, creative_id: int) -> AdCreative | None:
    return db.get(AdCreative, creative_id)


def create_creative(db: Session, campaign_id: int, **fields) -> AdCreative:
    creative = AdCreative(campaign_id=campaign_id, **fields)
    db.add(creative)
    db.commit()
    db.refresh(creative)
    return creative


def update_creative(db: Session, creative: AdCreative, **fields) -> AdCreative:
    for key, value in fields.items():
        setattr(creative, key, value)
    db.commit()
    db.refresh(creative)
    return creative


def pick_creative(campaign: AdCampaign, format: str) -> AdCreative | None:
    """Escolhe um criativo elegível pro formato pedido. Único ponto de
    aleatoriedade intencional do sistema (teste A/B por peso) — a
    precificação continua 100% determinística."""
    active = [c for c in campaign.creatives if c.is_active]
    specific = [c for c in active if c.format == format]
    pool = specific if specific else [c for c in active if c.format is None]
    if not pool:
        return None
    weights = [max(c.weight, 1) for c in pool]
    return random.choices(pool, weights=weights, k=1)[0]


# ── Elegibilidade / rotação ──────────────────────────────────────────────
def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def _matches_targeting(targeting: dict, ctx: dict) -> bool:
    """Cada eixo: se a campanha não restringe aquele eixo, não filtra. Se o
    cliente ainda não manda o sinal correspondente (rollout gradual), também
    não exclui — permissivo por padrão (ver seção de Segmentação do plano)."""
    neighborhood = ctx.get("neighborhood")
    citywide = bool(targeting.get("citywide", False))
    neighborhoods = set(targeting.get("neighborhoods", []))

    if not citywide:
        candidates = set()
        if neighborhood:
            candidates.add(neighborhood)
        if targeting.get("include_nearby"):
            candidates.update(ctx.get("nearby_neighborhoods") or [])
        if neighborhoods and not (candidates & neighborhoods):
            return False

    radius_km = targeting.get("radius_km")
    center_lat, center_lng = targeting.get("center_lat"), targeting.get("center_lng")
    if radius_km is not None and center_lat is not None and center_lng is not None:
        lat, lng = ctx.get("lat"), ctx.get("lng")
        if lat is not None and lng is not None:
            if _haversine_km(center_lat, center_lng, lat, lng) > radius_km:
                return False

    audience = targeting.get("audience", "all")
    view_mode = ctx.get("view_mode")
    if audience == "residents" and view_mode not in (None, "home"):
        return False
    if audience == "visitors" and view_mode not in (None, "nearby"):
        return False

    categories = targeting.get("categories") or []
    if categories:
        category = ctx.get("category")
        if category is not None and category not in categories:
            return False

    group_ids = targeting.get("group_ids") or []
    if group_ids:
        ctx_groups = ctx.get("group_ids") or []
        if ctx_groups and not (set(ctx_groups) & set(group_ids)):
            return False

    user_recency = targeting.get("user_recency", "all")
    if user_recency != "all":
        recency = ctx.get("recency")
        if recency is not None and recency != user_recency:
            return False

    engagement = targeting.get("engagement", "any")
    if engagement == "active":
        ctx_engagement = ctx.get("engagement")
        if ctx_engagement is not None and ctx_engagement != "active":
            return False

    return True


def _matches_schedule(schedule: dict, now: datetime) -> bool:
    special_dates = schedule.get("special_dates") or []
    if special_dates:
        return now.date().isoformat() in special_dates

    hours = schedule.get("hours")
    if hours is not None and now.hour not in hours:
        return False

    days_of_week = schedule.get("days_of_week")
    if days_of_week is not None and now.weekday() not in days_of_week:
        return False

    return True


def _candidates_for_format(db: Session, format: str) -> list[AdCampaign]:
    # SQLite não filtra bem dentro de uma coluna JSON list em SQL puro — como
    # em outras partes do projeto (ver CLAUDE.md sobre greatest/least), o
    # filtro fino (formato/segmentação/agenda) é feito em Python sobre um
    # conjunto já reduzido por status e janela de tempo.
    now = datetime.now(timezone.utc)
    q = db.query(AdCampaign).filter(
        AdCampaign.status == STATUS_ACTIVE,
        or_(AdCampaign.starts_at.is_(None), AdCampaign.starts_at <= now),
        or_(AdCampaign.ends_at.is_(None), AdCampaign.ends_at >= now),
    )
    return [c for c in q.all() if format in c.formats]


def _within_caps(db: Session, campaign: AdCampaign, viewer_id: str | None) -> bool:
    if campaign.daily_impression_cap is not None:
        start_of_day = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        served_today = (
            db.query(AdEvent)
            .filter(
                AdEvent.campaign_id == campaign.id,
                AdEvent.event_type == EVENT_IMPRESSION,
                AdEvent.occurred_at >= start_of_day,
            )
            .count()
        )
        if served_today >= campaign.daily_impression_cap:
            return False

    if campaign.per_user_impression_cap is not None and viewer_id:
        served_to_viewer = (
            db.query(AdEvent)
            .filter(
                AdEvent.campaign_id == campaign.id,
                AdEvent.event_type == EVENT_IMPRESSION,
                AdEvent.viewer_id == viewer_id,
            )
            .count()
        )
        if served_to_viewer >= campaign.per_user_impression_cap:
            return False

    return True


def _pacing_factor(db: Session, campaign: AdCampaign, now: datetime) -> float:
    if campaign.pacing != "even" or campaign.daily_impression_cap is None:
        return 1.0
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elapsed_fraction = (now - start_of_day).total_seconds() / 86400
    target_so_far = campaign.daily_impression_cap * elapsed_fraction
    served_today = (
        db.query(AdEvent)
        .filter(
            AdEvent.campaign_id == campaign.id,
            AdEvent.event_type == EVENT_IMPRESSION,
            AdEvent.occurred_at >= start_of_day,
        )
        .count()
    )
    return 0.3 if served_today >= target_so_far else 1.0


def get_active_for_format(db: Session, format: str, ctx: dict) -> AdCampaign | None:
    now = datetime.now(timezone.utc)
    candidates = _candidates_for_format(db, format)
    eligible = [
        c
        for c in candidates
        if _matches_targeting(c.targeting, ctx)
        and _matches_schedule(c.schedule, now)
        and _within_caps(db, c, ctx.get("viewer_id"))
    ]
    if not eligible:
        return None

    top_priority = max(c.priority for c in eligible)
    top_tier = [c for c in eligible if c.priority == top_priority]
    weights = [c.rotation_weight * _pacing_factor(db, c, now) for c in top_tier]
    if sum(weights) <= 0:
        weights = [1.0 for _ in top_tier]
    return random.choices(top_tier, weights=weights, k=1)[0]


# ── Eventos (impressão/clique) ───────────────────────────────────────────
def log_event(
    db: Session,
    *,
    campaign: AdCampaign,
    creative: AdCreative | None,
    event_type: str,
    format: str,
    neighborhood: str | None,
    viewer_id: str | None,
    objective_action: str | None = None,
) -> None:
    db.add(
        AdEvent(
            campaign_id=campaign.id,
            creative_id=creative.id if creative else None,
            event_type=event_type,
            format=format,
            neighborhood=neighborhood,
            viewer_id=viewer_id,
            objective_action=objective_action,
        )
    )
    if event_type == EVENT_IMPRESSION:
        campaign.impressions_count += 1
        campaign.last_served_at = datetime.now(timezone.utc)
        if creative:
            creative.impressions_count += 1
    else:
        campaign.clicks_count += 1
        if creative:
            creative.clicks_count += 1
    db.commit()


def list_events(db: Session, campaign_id: int) -> list[AdEvent]:
    return db.query(AdEvent).filter(AdEvent.campaign_id == campaign_id).all()


# ── Analytics agregado (admin) ───────────────────────────────────────────
def list_campaigns_by_email(db: Session, email: str) -> list[AdCampaign]:
    """Campanhas do próprio anunciante, vistas de dentro do app Daqui (sidebar
    "Meus anúncios"/"Anuncie conosco") — filtro por igualdade exata de e-mail
    (não `ilike` parcial como `list_campaigns_filtered`, que é busca livre do
    time interno), já que aqui o e-mail vem do usuário logado no Daqui, não
    de um texto digitado por um admin."""
    return (
        db.query(AdCampaign)
        .filter(AdCampaign.advertiser_email == email)
        .order_by(AdCampaign.created_at.desc())
        .all()
    )


def count_campaigns_by_email(db: Session, email: str) -> int:
    return db.query(AdCampaign).filter(AdCampaign.advertiser_email == email).count()


def list_campaigns_filtered(
    db: Session, *, advertiser: str | None = None, status: str | None = None
) -> list[AdCampaign]:
    q = db.query(AdCampaign)
    if status:
        q = q.filter(AdCampaign.status == status)
    if advertiser:
        like = f"%{advertiser}%"
        q = q.filter(
            or_(
                AdCampaign.advertiser_name.ilike(like),
                AdCampaign.advertiser_email.ilike(like),
            )
        )
    return q.order_by(AdCampaign.created_at.desc()).all()


def list_events_for_campaigns(
    db: Session,
    campaign_ids: list[int],
    date_from: datetime | None,
    date_to: datetime | None,
) -> list[AdEvent]:
    if not campaign_ids:
        return []
    q = db.query(AdEvent).filter(AdEvent.campaign_id.in_(campaign_ids))
    if date_from:
        q = q.filter(AdEvent.occurred_at >= date_from)
    if date_to:
        q = q.filter(AdEvent.occurred_at <= date_to)
    return q.all()


def list_distinct_advertisers(db: Session) -> list[str]:
    rows = (
        db.query(AdCampaign.advertiser_name)
        .distinct()
        .order_by(AdCampaign.advertiser_name)
        .all()
    )
    return [r[0] for r in rows if r[0]]
