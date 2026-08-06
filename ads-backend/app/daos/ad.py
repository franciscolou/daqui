import math
import random
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.ad import (
    AdCampaign,
    AdCampaignStatus,
    AdComment,
    AdCreative,
    AdEvent,
    AdEventType,
    AdFormat,
    AdLike,
    AdPlan,
    AdRepost,
    Audience,
    EngagementLevel,
    GeoScope,
    ObjectiveAction,
    UserRecency,
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
    if campaign.root_campaign_id is None:
        # Toda campanha é sua própria raiz até ser renovada — se o caller
        # (ver services/ad.py::checkout()/admin_create_manual_campaign())
        # já resolveu um root_campaign_id (renovação), não sobrescreve.
        campaign.root_campaign_id = campaign.id
    for creative_fields in creatives:
        db.add(AdCreative(campaign_id=campaign.id, **creative_fields))
    db.commit()
    db.refresh(campaign)
    return campaign


def get_campaign(db: Session, campaign_id: int) -> AdCampaign | None:
    return db.get(AdCampaign, campaign_id)


def get_campaign_by_token(db: Session, token: str) -> AdCampaign | None:
    return db.query(AdCampaign).filter(AdCampaign.access_token == token).first()


def list_campaign_family(db: Session, root_campaign_id: int) -> list[AdCampaign]:
    """Todos os períodos (renovações) de uma "campanha lógica", incluindo o
    ancestral em si — ver AdCampaign.root_campaign_id."""
    return (
        db.query(AdCampaign)
        .filter(
            or_(
                AdCampaign.root_campaign_id == root_campaign_id,
                AdCampaign.id == root_campaign_id,
            )
        )
        .order_by(AdCampaign.created_at.asc())
        .all()
    )


def list_campaigns(db: Session, status: AdCampaignStatus | None = None) -> list[AdCampaign]:
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


def _scope_cities(targeting: dict) -> set[str] | None:
    """Conjunto de cidades "cobertas" por um targeting, em minúsculas — só
    definido pra escopos que têm cidade conhecida (`citywide`/`cities`).
    `None` quando o escopo é `neighborhood` (cidade desconhecida: nada nos
    modelos guarda a cidade dos bairros hoje) ou `country` (não faz sentido
    comparar por conjunto, sempre disputa com tudo — ver `_competes`)."""
    scope = targeting.get("geo_scope", GeoScope.NEIGHBORHOOD)
    if scope == GeoScope.CITYWIDE:
        city = targeting.get("city")
        return {city.strip().lower()} if city else set()
    if scope == GeoScope.CITIES:
        return {c.strip().lower() for c in targeting.get("cities", []) if c}
    return None


def _competes(a: dict, b: dict) -> bool:
    """Duas campanhas disputam a mesma audiência? `country` sempre disputa
    com qualquer outra (cobre todo mundo); entre dois escopos com cidade
    conhecida, compara o conjunto de cidades; entre dois `neighborhood`,
    compara bairros; qualquer combinação envolvendo um `neighborhood` (cidade
    desconhecida) contra um escopo com cidade é tratada, por cautela, como
    concorrência (mesmo espírito permissivo do `citywide` de antes)."""
    a_scope = a.get("geo_scope", GeoScope.NEIGHBORHOOD)
    b_scope = b.get("geo_scope", GeoScope.NEIGHBORHOOD)
    if a_scope == GeoScope.COUNTRY or b_scope == GeoScope.COUNTRY:
        return True
    if a_scope == GeoScope.NEIGHBORHOOD and b_scope == GeoScope.NEIGHBORHOOD:
        return bool(set(a.get("neighborhoods", [])) & set(b.get("neighborhoods", [])))
    a_cities, b_cities = _scope_cities(a), _scope_cities(b)
    if a_cities is not None and b_cities is not None:
        return bool(a_cities & b_cities)
    return True


def count_competing_campaigns(db: Session, targeting: dict) -> int:
    """Quantas campanhas ativas/pendentes já disputam a mesma audiência —
    usado só pelo fator `competition_multiplier` da precificação."""
    candidates = (
        db.query(AdCampaign)
        .filter(AdCampaign.status.in_([AdCampaignStatus.ACTIVE, AdCampaignStatus.PENDING_PAYMENT]))
        .all()
    )
    return sum(1 for c in candidates if _competes(targeting, c.targeting))


# ── Criativos ────────────────────────────────────────────────────────────
def list_creatives(db: Session, campaign_id: int) -> list[AdCreative]:
    return db.query(AdCreative).filter(AdCreative.campaign_id == campaign_id).all()


def get_creative(db: Session, creative_id: int) -> AdCreative | None:
    return db.get(AdCreative, creative_id)


def upsert_creatives_by_format(
    db: Session, campaign: AdCampaign, creatives: list[dict]
) -> None:
    """Substitui o conjunto de criativos por-formato do anunciante: casa por
    `format` (chave natural do editor — um bloco fixo por formato, sem teste
    A/B), preserva id/contadores do que já existe naquele formato, cria o que
    falta, remove o que saiu do payload."""
    existing_by_format = {c.format: c for c in campaign.creatives}
    incoming_formats: set[str | None] = set()
    for fields in creatives:
        fmt = fields.get("format")
        incoming_formats.add(fmt)
        existing = existing_by_format.get(fmt)
        if existing:
            for key, value in fields.items():
                setattr(existing, key, value)
        else:
            db.add(AdCreative(campaign_id=campaign.id, **fields))
    for fmt, existing in existing_by_format.items():
        if fmt not in incoming_formats:
            db.delete(existing)
    db.commit()
    db.refresh(campaign)


def pick_creative(campaign: AdCampaign, format: AdFormat) -> AdCreative | None:
    """Resolve o criativo do formato pedido: no máximo um por formato (sem
    teste A/B) — um específico daquele formato sobrepõe o padrão
    (`format=None`), que serve de fallback."""
    creatives = campaign.creatives
    if format == AdFormat.MAP:
        # No mapa o criativo precisa ter pin; o do formato "mapa" pode ter sido
        # cadastrado sem coordenadas (criação manual), caso em que o base —
        # que é onde o lat/lng mora por convenção do editor — assume.
        creatives = [c for c in creatives if c.latitude is not None and c.longitude is not None]
    specific = [c for c in creatives if c.format == format]
    if specific:
        return specific[0]
    default = [c for c in creatives if c.format is None]
    return default[0] if default else None


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
    não exclui — permissivo por padrão (ver seção de Segmentação do plano).

    Exceção deliberada: os escopos `citywide`/`cities` filtram de verdade por
    `ctx["city"]` (cidade do usuário, resolvida no backend principal) — sem
    isso, "cidade toda" e "país todo" seriam indistinguíveis (o app hoje é
    mono-cidade só por acidente de não ter esse filtro nunca existido)."""
    scope = targeting.get("geo_scope", "neighborhood")
    neighborhood = ctx.get("neighborhood")
    city = ctx.get("city")

    if scope == "country":
        pass
    elif scope == "cities":
        cities = {c.strip().lower() for c in targeting.get("cities", []) if c}
        if not city or city.strip().lower() not in cities:
            return False
    elif scope == "citywide":
        target_city = (targeting.get("city") or "").strip().lower()
        if not city or city.strip().lower() != target_city:
            return False
    else:  # neighborhood
        neighborhoods = set(targeting.get("neighborhoods", []))
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

    audience = targeting.get("audience", Audience.ALL)
    view_mode = ctx.get("view_mode")
    if audience == Audience.RESIDENTS and view_mode not in (None, "home"):
        return False
    if audience == Audience.VISITORS and view_mode not in (None, "nearby"):
        return False

    categories = targeting.get("categories") or []
    if categories:
        category = ctx.get("category")
        if category is not None and category not in categories:
            return False

    user_recency = targeting.get("user_recency", UserRecency.ALL)
    if user_recency != UserRecency.ALL:
        recency = ctx.get("recency")
        if recency is not None and recency != user_recency:
            return False

    engagement = targeting.get("engagement", EngagementLevel.ANY)
    if engagement == EngagementLevel.ACTIVE:
        ctx_engagement = ctx.get("engagement")
        if ctx_engagement is not None and ctx_engagement != EngagementLevel.ACTIVE:
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


def _candidates_for_format(db: Session, format: AdFormat) -> list[AdCampaign]:
    # SQLite não filtra bem dentro de uma coluna JSON list em SQL puro — como
    # em outras partes do projeto (ver CLAUDE.md sobre greatest/least), o
    # filtro fino (formato/segmentação/agenda) é feito em Python sobre um
    # conjunto já reduzido por status e janela de tempo.
    now = datetime.now(timezone.utc)
    q = db.query(AdCampaign).filter(
        AdCampaign.status == AdCampaignStatus.ACTIVE,
        or_(AdCampaign.starts_at.is_(None), AdCampaign.starts_at <= now),
        or_(AdCampaign.ends_at.is_(None), AdCampaign.ends_at >= now),
    )
    candidates = [c for c in q.all() if format in c.formats]
    if format == AdFormat.MAP:
        # No mapa, um anúncio sem coordenadas não vira pin nenhum — servi-lo
        # só queimaria a impressão. A criação já exige o pin (ver
        # `schemas/ad.py::check_map_has_pin`); isto protege campanhas antigas
        # e criativos editados depois.
        candidates = [c for c in candidates if _has_pin(c)]
    return candidates


def _has_pin(campaign: AdCampaign) -> bool:
    return any(
        c.latitude is not None and c.longitude is not None
        for c in campaign.creatives
    )


def _within_caps(db: Session, campaign: AdCampaign, viewer_id: str | None) -> bool:
    if campaign.per_user_impression_cap is not None and viewer_id:
        served_to_viewer = (
            db.query(AdEvent)
            .filter(
                AdEvent.campaign_id == campaign.id,
                AdEvent.event_type == AdEventType.IMPRESSION,
                AdEvent.viewer_id == viewer_id,
            )
            .count()
        )
        if served_to_viewer >= campaign.per_user_impression_cap:
            return False

    return True


def _eligible_for_format(db: Session, format: AdFormat, ctx: dict, now: datetime) -> list[AdCampaign]:
    candidates = _candidates_for_format(db, format)
    return [
        c
        for c in candidates
        if _matches_targeting(c.targeting, ctx)
        and _matches_schedule(c.schedule, now)
        and _within_caps(db, c, ctx.get("viewer_id"))
    ]


def _group_by_advertiser(campaigns: list[AdCampaign]) -> dict[str, list[AdCampaign]]:
    groups: dict[str, list[AdCampaign]] = defaultdict(list)
    for c in campaigns:
        groups[c.advertiser_email].append(c)
    return groups


def _pick_from_tier(top_tier: list[AdCampaign]) -> AdCampaign:
    """Sorteio em duas etapas: primeiro um anunciante (`advertiser_email`)
    entre os concorrentes do mesmo nível de prioridade, todos com a mesma
    chance — não importa quantas campanhas ele tenha ali nem o `rotation_weight`
    delas, senão bastaria criar várias campanhas parecidas pra multiplicar a
    própria chance. Só *depois* de decidido o anunciante, o `rotation_weight`
    entra em jogo pra escolher qual campanha dele exibir — é aí que ele faz
    sentido de verdade: dividir a própria cota entre variações de anúncio
    (ex: 70/30 entre duas artes), nunca pra disputar contra outro anunciante."""
    groups = _group_by_advertiser(top_tier)
    advertiser_campaigns = random.choice(list(groups.values()))
    weights = [c.rotation_weight for c in advertiser_campaigns]
    if sum(weights) <= 0:
        weights = [1.0 for _ in advertiser_campaigns]
    return random.choices(advertiser_campaigns, weights=weights, k=1)[0]


def get_active_for_format(db: Session, format: AdFormat, ctx: dict) -> AdCampaign | None:
    now = datetime.now(timezone.utc)
    eligible = _eligible_for_format(db, format, ctx, now)
    if not eligible:
        return None

    top_priority = max(c.priority for c in eligible)
    top_tier = [c for c in eligible if c.priority == top_priority]
    return _pick_from_tier(top_tier)


def get_active_list_for_format(
    db: Session, format: AdFormat, ctx: dict, exclude_ids: list[int], limit: int
) -> list[AdCampaign]:
    """Várias campanhas elegíveis pro formato (rolagem infinita da Busca, que
    pode mostrar mais de um anúncio). Nunca repete uma campanha já mostrada
    nesta sessão (`exclude_ids`) — quando o pool elegível ainda não visto se
    esgota, a lista simplesmente some vazia (o cliente para de pedir mais)."""
    now = datetime.now(timezone.utc)
    eligible = _eligible_for_format(db, format, ctx, now)
    if not eligible:
        return []

    top_priority = max(c.priority for c in eligible)
    top_tier = [c for c in eligible if c.priority == top_priority]
    pool = [c for c in top_tier if c.id not in exclude_ids]
    if not pool:
        return []

    # Mesmo sorteio em duas etapas de `_pick_from_tier`, repetido sem
    # reposição: a cada rodada, sorteia um anunciante (chance igual entre os
    # que ainda têm campanha não escolhida) e só então uma campanha dele por
    # `rotation_weight`, removendo-a do próprio grupo pra próxima rodada.
    groups = _group_by_advertiser(pool)
    chosen: list[AdCampaign] = []
    for _ in range(min(limit, len(pool))):
        if not groups:
            break
        advertiser_email = random.choice(list(groups.keys()))
        candidates = groups[advertiser_email]
        weights = [max(c.rotation_weight, 0.0) for c in candidates]
        total = sum(weights) or len(candidates)
        r = random.uniform(0, total)
        upto = 0.0
        picked_idx = len(candidates) - 1
        for i, w in enumerate(weights):
            upto += w or 1.0
            if upto >= r:
                picked_idx = i
                break
        chosen.append(candidates.pop(picked_idx))
        if not candidates:
            del groups[advertiser_email]
    return chosen


# ── Eventos (impressão/clique) ───────────────────────────────────────────
def log_event(
    db: Session,
    *,
    campaign: AdCampaign,
    creative: AdCreative | None,
    event_type: AdEventType,
    format: AdFormat,
    neighborhood: str | None,
    viewer_id: str | None,
    objective_action: ObjectiveAction | None = None,
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
    if event_type == AdEventType.IMPRESSION:
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
    db: Session, *, advertiser: str | None = None, status: AdCampaignStatus | None = None
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


# ── Engajamento (curtida/repost/comentário num anúncio) ───────────────────
def get_like(db: Session, campaign_id: int, user_id: int) -> AdLike | None:
    return (
        db.query(AdLike)
        .filter(AdLike.campaign_id == campaign_id, AdLike.user_id == user_id)
        .first()
    )


def add_like(db: Session, campaign_id: int, user_id: int) -> AdLike:
    like = AdLike(campaign_id=campaign_id, user_id=user_id)
    db.add(like)
    return like


def remove_like(db: Session, like: AdLike) -> None:
    db.delete(like)


def get_repost(db: Session, campaign_id: int, user_id: int) -> AdRepost | None:
    return (
        db.query(AdRepost)
        .filter(AdRepost.campaign_id == campaign_id, AdRepost.user_id == user_id)
        .first()
    )


def add_repost(db: Session, campaign_id: int, user_id: int) -> AdRepost:
    repost = AdRepost(campaign_id=campaign_id, user_id=user_id)
    db.add(repost)
    return repost


def remove_repost(db: Session, repost: AdRepost) -> None:
    db.delete(repost)


def add_comment(db: Session, campaign_id: int, user_id: int, content: str) -> AdComment:
    comment = AdComment(campaign_id=campaign_id, user_id=user_id, content=content)
    db.add(comment)
    return comment


def get_comment(db: Session, comment_id: int) -> AdComment | None:
    return db.get(AdComment, comment_id)


def list_comments(db: Session, campaign_id: int) -> list[AdComment]:
    return (
        db.query(AdComment)
        .filter(AdComment.campaign_id == campaign_id)
        .order_by(AdComment.created_at.asc())
        .all()
    )


def delete_comment(db: Session, comment: AdComment) -> None:
    db.delete(comment)
