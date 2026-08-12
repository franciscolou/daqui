from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core import payments
from app.core.br_documents import validate_document
from app.core.uploads import save_upload_media
from app.daos import ad as ad_dao
from app.daos import ad_admin as admin_dao
from app.daos import ad_settings as settings_dao
from app.models.ad import (
    AdCampaign,
    AdCampaignStatus,
    AdEventType,
    AdFormat,
    AdObjective,
    GeoScope,
    PaymentProvider,
)
from app.models.ad_admin import AdAdmin
from app.models.ad_audit_log import AdAuditLogAction
from app.schemas.ad import (
    AdCommentIn,
    AdCommentOut,
    AdEngagementIn,
    AdOut,
    AdPlanCreate,
    AdPlanOut,
    AdPlanUpdate,
    AnalyticsBucket,
    AnalyticsOut,
    AnalyticsSummary,
    CampaignAdminOut,
    CampaignAnalyticsRow,
    CampaignContentSubmit,
    CampaignHistoryPeriod,
    CampaignUpdate,
    CheckoutRequest,
    CheckoutResponse,
    ClickIn,
    CreativeOut,
    GlobalAnalyticsOut,
    GlobalAnalyticsSummary,
    HasCampaignsOut,
    ImpressionIn,
    ManualCampaignCreate,
    MediaUploadOut,
    MyCampaignOut,
    MyCampaignUpdate,
    PriceFactor,
    QuoteRequest,
    QuoteResponse,
    ScheduleIn,
    TargetingIn,
    _check_map_has_pin,
)
from app.schemas.ad_settings import AdSettingsOut, AdSettingsUpdate
from app.services import ad_audit_log as audit_log_service
from app.services import ad_pricing

WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

FORMAT_LABELS = {
    AdFormat.POST: "Post no feed",
    AdFormat.MAP: "Pin no mapa",
    AdFormat.CONVERSATION: "Conversa (Mensagens)",
    AdFormat.NOTIFICATION: "Novidades",
    AdFormat.SEARCH_POSTER: "Poster de busca",
}


def _fmt_brl(cents: int) -> str:
    s = f"{cents / 100:,.2f}"
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def _check_targeting(targeting: TargetingIn) -> None:
    if targeting.geo_scope == GeoScope.NEIGHBORHOOD and not targeting.neighborhoods:
        raise HTTPException(status_code=400, detail="Selecione ao menos um bairro")
    if targeting.geo_scope == GeoScope.CITYWIDE and not targeting.city:
        raise HTTPException(status_code=400, detail="Selecione a cidade")
    if targeting.geo_scope == GeoScope.CITIES and not targeting.cities:
        raise HTTPException(status_code=400, detail="Selecione ao menos uma cidade")


def _quote_breakdown(
    db: Session,
    *,
    formats: list[AdFormat],
    duration_days: int,
    targeting: TargetingIn,
    schedule: ScheduleIn,
    objective: AdObjective,
    priority: int,
    per_user_impression_cap: int | None,
) -> dict:
    competing_count = ad_dao.count_competing_campaigns(db, targeting.model_dump())
    return ad_pricing.quote(
        formats=formats,
        duration_days=duration_days,
        targeting=targeting.model_dump(),
        schedule=schedule.model_dump(),
        objective=objective,
        priority=priority,
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
    schedule = payload.schedule or ScheduleIn()
    if payload.plan_id is not None:
        plan = ad_dao.get_plan(db, payload.plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Plano não encontrado")
        if _plan_price_applicable(
            plan, targeting, schedule, payload.objective, payload.priority,
            payload.per_user_impression_cap,
        ):
            result = _plan_quote_breakdown(db, plan, payload.duration_days, payload.formats)
            return QuoteResponse(
                price_cents=result["price_cents"],
                base_cents=result["base_cents"],
                factors=[
                    PriceFactor(label=label, multiplier=m) for label, m in result["factors"]
                ],
            )
    _check_targeting(targeting)
    result = _quote_breakdown(
        db,
        formats=payload.formats,
        duration_days=payload.duration_days,
        targeting=targeting,
        schedule=schedule,
        objective=payload.objective,
        priority=payload.priority,
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


def _plan_price_applicable(
    plan,
    targeting: TargetingIn,
    schedule: ScheduleIn,
    objective: AdObjective,
    priority: int,
    per_user_impression_cap: int | None,
) -> bool:
    """O preço fixo de um plano só cobre o que `ad_pricing.plan_quote` de fato
    precifica: duração e formatos (que escalam) e o escopo geográfico do
    plano com QUALQUER bairro/cidade dentro do limite anunciado (que não
    escala — "até N bairros por R$ X" sempre custa R$ X). Nenhuma outra
    segmentação/agenda/objetivo/prioridade/limite de frequência entra na
    conta — então exige todos eles no padrão. Qualquer desvio disso (trocar
    o escopo geográfico inteiro, passar do limite de bairros/cidades, ligar
    qualquer configuração avançada) muda o custo real de entrega de um jeito
    que o preço fixo nunca embutiu; nesse caso o chamador deve cair pra
    mesma engine dinâmica usada sem plano nenhum (`ad_pricing.quote`), pra
    que uma configuração final igual sempre custe o mesmo, tenha ela
    partido de um plano ou não. Bug que isso corrige: antes, qualquer opção
    escolhida partindo de um plano (inclusive trocar pra "Brasil todo") não
    mexia nada no preço, então o valor final dependia só de qual plano se
    usou como ponto de partida — nunca da configuração escolhida de fato."""
    if targeting.geo_scope != plan.geo_scope:
        return False
    if plan.max_neighborhoods is not None and len(targeting.neighborhoods) > plan.max_neighborhoods:
        return False
    if plan.max_cities is not None and len(targeting.cities) > plan.max_cities:
        return False
    plan_default_targeting = TargetingIn(
        geo_scope=targeting.geo_scope,
        neighborhoods=targeting.neighborhoods,
        city=targeting.city,
        cities=targeting.cities,
    )
    if targeting.model_dump() != plan_default_targeting.model_dump():
        return False
    if schedule.model_dump() != ScheduleIn().model_dump():
        return False
    if objective != AdObjective.CLICKS or priority != 3 or per_user_impression_cap is not None:
        return False
    return True


def _plan_quote_breakdown(
    db: Session, plan, duration_days: int, formats: list[AdFormat] | None = None
) -> dict:
    """Preço de um plano predefinido (já com o multiplicador de mercado,
    igual ao mostrado no card em `list_public_plans`) — NÃO a cotação
    dinâmica completa: a segmentação (bairros, alcance, concorrência…) não
    entra aqui. É o que garante que "até 3 bairros por R$ X" cobre
    exatamente R$ X mesmo com os 3 bairros preenchidos. Só deve ser chamada
    quando `_plan_price_applicable` confirma que a configuração está dentro
    da "caixa" que esse preço fixo cobre.
    Quando `duration_days`/`formats` diferem dos do plano, o preço escala via
    `ad_pricing.plan_quote` (sempre menos por dia quanto mais tempo, e
    proporcional às superfícies escolhidas — ver docstring de lá)."""
    multiplier = settings_dao.get(db).price_multiplier
    result = ad_pricing.plan_quote(
        plan.price_cents,
        plan.duration_days,
        duration_days,
        plan_formats=plan.formats,
        formats=formats,
    )
    return {
        "price_cents": round(result["price_cents"] * multiplier),
        "base_cents": round(result["base_cents"] * multiplier),
        "factors": [*result["factors"], ("Ajuste de mercado", multiplier)],
    }


def _plan_locked_price(
    db: Session,
    plan_id: int | None,
    duration_days: int,
    formats: list[AdFormat],
    targeting: TargetingIn,
    schedule: ScheduleIn,
    objective: AdObjective,
    priority: int,
    per_user_impression_cap: int | None,
) -> int | None:
    """Preço final de uma campanha contratada via plano, pra a duração e os
    formatos escolhidos — os MESMOS argumentos e a MESMA regra de
    aplicabilidade (`_plan_price_applicable`) usados na cotação (`quote`),
    pra que o valor cobrado no checkout seja exatamente o que foi mostrado
    na tela. Sem plano, ou quando a configuração escolhida saiu da "caixa"
    que o preço fixo do plano cobre, devolve `None` e o preço volta a sair
    da engine dinâmica."""
    if plan_id is None:
        return None
    plan = ad_dao.get_plan(db, plan_id)
    if not plan or not _plan_price_applicable(
        plan, targeting, schedule, objective, priority, per_user_impression_cap
    ):
        return None
    result = _plan_quote_breakdown(db, plan, duration_days, formats)
    return result["price_cents"]


def checkout(db: Session, payload: CheckoutRequest) -> CheckoutResponse:
    targeting = payload.effective_targeting()
    _check_targeting(targeting)
    schedule = payload.schedule or ScheduleIn()
    price_cents = _plan_locked_price(
        db, payload.plan_id, payload.duration_days, payload.formats,
        targeting, schedule, payload.objective, payload.priority,
        payload.per_user_impression_cap,
    )
    if price_cents is None:
        result = _quote_breakdown(
            db,
            formats=payload.formats,
            duration_days=payload.duration_days,
            targeting=targeting,
            schedule=schedule,
            objective=payload.objective,
            priority=payload.priority,
            per_user_impression_cap=payload.per_user_impression_cap,
        )
        price_cents = result["price_cents"]
    creatives = [c.model_dump() for c in payload.effective_creatives()]
    renewed_from_id, root_campaign_id = _resolve_renewal(db, payload.renewed_from_token)
    campaign = ad_dao.create_campaign(
        db,
        creatives=creatives,
        plan_id=payload.plan_id,
        status=AdCampaignStatus.PENDING_PAYMENT,
        advertiser_name=payload.advertiser_name,
        advertiser_email=payload.advertiser_email,
        advertiser_phone=payload.advertiser_phone,
        advertiser_type=payload.advertiser_type,
        advertiser_document=payload.advertiser_document,
        formats=payload.formats,
        price_cents=price_cents,
        targeting=targeting.model_dump(),
        duration_days=payload.duration_days,
        objective=payload.objective,
        priority=payload.priority,
        rotation_weight=payload.rotation_weight,
        per_user_impression_cap=payload.per_user_impression_cap,
        starts_at=payload.starts_at,
        schedule=schedule.model_dump(),
        payment_provider=PaymentProvider.ASAAS,
        renewed_from_id=renewed_from_id,
        root_campaign_id=root_campaign_id,
    )
    title = campaign.creatives[0].title if campaign.creatives else "Anúncio"
    checkout_url = payments.create_checkout_session(
        campaign.id,
        campaign.access_token,
        title,
        price_cents,
        advertiser_name=campaign.advertiser_name,
        advertiser_email=campaign.advertiser_email,
        advertiser_phone=campaign.advertiser_phone,
        advertiser_document=campaign.advertiser_document,
    )
    return CheckoutResponse(campaign_id=campaign.id, checkout_url=checkout_url)


def _resolve_renewal(
    db: Session, renewed_from_token: str | None
) -> tuple[int | None, int | None]:
    """Se a criação referencia uma campanha anterior (reativação), resolve
    `renewed_from_id`/`root_campaign_id` a partir do token dela — usado tanto
    pelo checkout self-service quanto pela criação manual do admin."""
    if not renewed_from_token:
        return None, None
    prior = ad_dao.get_campaign_by_token(db, renewed_from_token)
    if not prior:
        raise HTTPException(status_code=404, detail="Campanha anterior não encontrada")
    return prior.id, (prior.root_campaign_id or prior.id)


def _activate(
    db: Session,
    campaign: AdCampaign,
    payment_reference: str | None,
    payment_provider: str | None = None,
    actor: AdAdmin | None = None,
) -> None:
    """Ativa a campanha. `actor` só vem preenchido quando quem chamou é uma
    ação de admin com sessão própria (`admin_mark_campaign_paid` — esse já
    loga `CAMPAIGN_MARK_PAID` ali mesmo, então aqui não duplica). Sem `actor`
    (webhook do Asaas, sem admin nenhum na jogada), registra
    `PROPOSAL_ACTIVATED` atribuído ao admin que criou a proposta, só quando a
    campanha vier de uma proposta manual — o checkout self-service não tem
    admin nenhum a quem atribuir."""
    now = datetime.now(timezone.utc)
    # `campaign.starts_at` já vem preenchido desde a criação se o anunciante
    # escolheu uma data de início específica (ver `checkout`/
    # `admin_create_manual_campaign`) — só cai pro comportamento antigo
    # (começar agora) quando não foi escolhida nenhuma, ou quando a data
    # escolhida já ficou no passado por demorar pra pagar (nunca deixa a
    # campanha nascer com início retroativo).
    requested_starts_at = campaign.starts_at
    if requested_starts_at is not None and requested_starts_at.tzinfo is None:
        # SQLite não guarda tz — mesmo caso de daos/geo_cache.py.
        requested_starts_at = requested_starts_at.replace(tzinfo=timezone.utc)
    starts_at = requested_starts_at if requested_starts_at and requested_starts_at > now else now
    fields = dict(
        status=AdCampaignStatus.ACTIVE,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(days=campaign.duration_days),
        paid_at=now,
        payment_reference=payment_reference,
    )
    if payment_provider is not None:
        fields["payment_provider"] = payment_provider
    campaign = ad_dao.update_campaign(db, campaign, **fields)
    if actor is None and campaign.created_by_admin_id is not None:
        admin = admin_dao.get_by_id(db, campaign.created_by_admin_id)
        if admin:
            audit_log_service.log(
                db,
                admin,
                AdAuditLogAction.PROPOSAL_ACTIVATED,
                detail=(
                    f"Campanha de {campaign.advertiser_name} "
                    f"({campaign.advertiser_email}) foi ativada"
                ),
            )


def handle_asaas_webhook(db: Session, payload: bytes, token: str) -> None:
    """PAYMENT_CONFIRMED, não PAYMENT_RECEIVED: o segundo só dispara quando o
    valor já está disponível na conta Asaas, o que pro cartão parcelado pode
    demorar dias — ativar a campanha não deveria depender do calendário de
    liquidação do Asaas, só de o pagamento ter sido aprovado (mesmo momento
    em que o checkout.session.completed da Stripe disparava antes)."""
    event = payments.verify_webhook(payload, token)
    if event.get("event") != "PAYMENT_CONFIRMED":
        return
    payment = event.get("payment") or {}
    campaign_id = int(payment["externalReference"])
    campaign = ad_dao.get_campaign(db, campaign_id)
    if campaign and campaign.status == AdCampaignStatus.PENDING_PAYMENT:
        _activate(db, campaign, payment.get("id"))


def _is_publicly_visible(campaign: AdCampaign) -> bool:
    """Campanha não-expirada segue acessível como sempre. Expirada só
    continua acessível (detalhe, curtir/comentar/repostar) se o post tiver
    conta vinculada — aí ela "assenta" como post normal daquele usuário (ver
    get_linked_posts_for_user). Sem vínculo, uma vez expirada ela só volta a
    ficar visível/reativável no painel do próprio anunciante (por
    access_token, que não passa por aqui — ver get_my_campaign)."""
    if campaign.status != AdCampaignStatus.EXPIRED:
        return True
    creative = ad_dao.pick_creative(campaign, AdFormat.POST)
    return bool(creative and creative.linked_user_id)


def get_active_ad(db: Session, format: AdFormat, ctx: dict) -> AdOut | None:
    campaign = ad_dao.get_active_for_format(db, format, ctx)
    if not campaign:
        return None
    return _campaign_to_ad_out(db, campaign, format, ctx)


def _campaign_to_ad_out(
    db: Session, campaign: AdCampaign, format: AdFormat, ctx: dict
) -> AdOut | None:
    # Não loga IMPRESSION aqui: isto só serve o anúncio (ver `_within_caps`
    # sobre por que servir != ser visto). A impressão de verdade é registrada
    # por `track_impression`, chamado pelo cliente só quando o anúncio fica
    # de fato visível na tela (ver `frontend/lib/useAdImpression.ts`).
    creative = ad_dao.pick_creative(campaign, format)
    if not creative:
        return None
    return _to_ad_out(db, campaign, creative, ctx.get("user_id"))


def _to_ad_out(
    db: Session, campaign: AdCampaign, creative, user_id: int | None
) -> AdOut:
    liked = user_id is not None and ad_dao.get_like(db, campaign.id, user_id) is not None
    reposted = (
        user_id is not None and ad_dao.get_repost(db, campaign.id, user_id) is not None
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
        linked_user_id=creative.linked_user_id,
        likes_count=campaign.likes_count,
        comments_count=campaign.comments_count,
        reposts_count=campaign.reposts_count,
        liked=liked,
        reposted=reposted,
        created_at=campaign.created_at,
    )


def get_ad_detail(
    db: Session, campaign_id: int, creative_id: int | None, user_id: int | None
) -> AdOut:
    campaign = ad_dao.get_campaign(db, campaign_id)
    if not campaign or not _is_publicly_visible(campaign):
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    creative = (
        ad_dao.get_creative(db, creative_id) if creative_id is not None else None
    )
    if not creative:
        creative = ad_dao.pick_creative(campaign, AdFormat.POST)
    if not creative:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    return _to_ad_out(db, campaign, creative, user_id)


def toggle_ad_like(db: Session, campaign_id: int, payload: AdEngagementIn) -> AdOut:
    campaign = ad_dao.get_campaign(db, campaign_id)
    if not campaign or not _is_publicly_visible(campaign):
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    existing = ad_dao.get_like(db, campaign_id, payload.user_id)
    if existing:
        ad_dao.remove_like(db, existing)
        campaign.likes_count = max(0, campaign.likes_count - 1)
    else:
        ad_dao.add_like(db, campaign_id, payload.user_id)
        campaign.likes_count += 1
    db.commit()
    db.refresh(campaign)
    return get_ad_detail(db, campaign_id, payload.creative_id, payload.user_id)


def toggle_ad_repost(db: Session, campaign_id: int, payload: AdEngagementIn) -> AdOut:
    campaign = ad_dao.get_campaign(db, campaign_id)
    if not campaign or not _is_publicly_visible(campaign):
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    existing = ad_dao.get_repost(db, campaign_id, payload.user_id)
    if existing:
        ad_dao.remove_repost(db, existing)
        campaign.reposts_count = max(0, campaign.reposts_count - 1)
    else:
        ad_dao.add_repost(db, campaign_id, payload.user_id)
        campaign.reposts_count += 1
    db.commit()
    db.refresh(campaign)
    return get_ad_detail(db, campaign_id, payload.creative_id, payload.user_id)


def list_ad_comments(db: Session, campaign_id: int) -> list[AdCommentOut]:
    campaign = ad_dao.get_campaign(db, campaign_id)
    if not campaign or not _is_publicly_visible(campaign):
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    comments = ad_dao.list_comments(db, campaign_id)
    return [AdCommentOut.model_validate(c) for c in comments]


def create_ad_comment(
    db: Session, campaign_id: int, payload: AdCommentIn
) -> AdCommentOut:
    campaign = ad_dao.get_campaign(db, campaign_id)
    if not campaign or not _is_publicly_visible(campaign):
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    comment = ad_dao.add_comment(db, campaign_id, payload.user_id, payload.content)
    campaign.comments_count += 1
    db.commit()
    db.refresh(comment)
    return AdCommentOut.model_validate(comment)


def delete_ad_comment(
    db: Session, campaign_id: int, comment_id: int, user_id: int
) -> None:
    comment = ad_dao.get_comment(db, comment_id)
    if not comment or comment.campaign_id != campaign_id:
        raise HTTPException(status_code=404, detail="Comentário não encontrado")
    if comment.user_id != user_id:
        raise HTTPException(status_code=403, detail="Sem permissão para apagar este comentário")
    campaign = ad_dao.get_campaign(db, campaign_id)
    ad_dao.delete_comment(db, comment)
    if campaign:
        campaign.comments_count = max(0, campaign.comments_count - 1)
    db.commit()


def get_linked_posts_for_user(
    db: Session, user_id: int, viewer_user_id: int | None
) -> list[AdOut]:
    """Posts de anúncios expirados vinculados a esta conta — o que o
    frontend mescla na timeline do perfil como post normal (sem tag
    "Patrocinado", já que a campanha não impulsiona mais nada). Ver
    _is_publicly_visible/pick_creative sobre por que só sobrevive quem tinha
    o vínculo no criativo que efetivamente vira o "post"."""
    campaigns = ad_dao.list_expired_linked_campaigns(db, user_id)
    out = []
    for campaign in campaigns:
        creative = ad_dao.pick_creative(campaign, AdFormat.POST)
        if not creative or creative.linked_user_id != user_id:
            continue
        out.append(_to_ad_out(db, campaign, creative, viewer_user_id))
    return out


def get_active_ad_list(
    db: Session, format: AdFormat, ctx: dict, exclude_ids: list[int], limit: int
) -> list[AdOut]:
    campaigns = ad_dao.get_active_list_for_format(db, format, ctx, exclude_ids, limit)
    ads = []
    for campaign in campaigns:
        ad = _campaign_to_ad_out(db, campaign, format, ctx)
        if ad:
            ads.append(ad)
    return ads


def track_click(db: Session, campaign_id: int, payload: ClickIn | None) -> None:
    campaign = ad_dao.get_campaign(db, campaign_id)
    if not campaign or not _is_publicly_visible(campaign):
        return
    payload = payload or ClickIn()
    creative = None
    if payload.creative_id is not None:
        creative = ad_dao.get_creative(db, payload.creative_id)
    ad_dao.log_event(
        db,
        campaign=campaign,
        creative=creative,
        event_type=AdEventType.CLICK,
        format=payload.format or "",
        neighborhood=None,
        viewer_id=payload.viewer_id,
        objective_action=payload.objective_action,
    )


def track_impression(db: Session, campaign_id: int, payload: ImpressionIn | None) -> None:
    campaign = ad_dao.get_campaign(db, campaign_id)
    if not campaign or not _is_publicly_visible(campaign):
        return
    payload = payload or ImpressionIn()
    creative = None
    if payload.creative_id is not None:
        creative = ad_dao.get_creative(db, payload.creative_id)
    ad_dao.log_event(
        db,
        campaign=campaign,
        creative=creative,
        event_type=AdEventType.IMPRESSION,
        format=payload.format or "",
        neighborhood=payload.neighborhood,
        viewer_id=payload.viewer_id,
    )


# ── Admin de anúncios ───────────────────────────────────────────────────
def admin_get_settings(db: Session) -> AdSettingsOut:
    return AdSettingsOut.model_validate(settings_dao.get(db))


def admin_update_settings(db: Session, payload: AdSettingsUpdate) -> AdSettingsOut:
    current = settings_dao.get(db)
    updated = settings_dao.update(db, current, **payload.model_dump())
    return AdSettingsOut.model_validate(updated)


def admin_create_plan(db: Session, actor: AdAdmin, payload: AdPlanCreate) -> AdPlanOut:
    plan = ad_dao.create_plan(db, **payload.model_dump())
    audit_log_service.log(
        db, actor, AdAuditLogAction.PLAN_CREATE, detail=f'Criou o plano "{plan.name}"'
    )
    return AdPlanOut.model_validate(plan)


def admin_list_plans(db: Session) -> list[AdPlanOut]:
    return [AdPlanOut.model_validate(p) for p in ad_dao.list_all_plans(db)]


def admin_update_plan(
    db: Session, actor: AdAdmin, plan_id: int, payload: AdPlanUpdate
) -> AdPlanOut:
    plan = ad_dao.get_plan(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    plan = ad_dao.update_plan(db, plan, **fields)
    audit_log_service.log(
        db, actor, AdAuditLogAction.PLAN_UPDATE, detail=f'Editou o plano "{plan.name}"'
    )
    return AdPlanOut.model_validate(plan)


def admin_delete_plan(db: Session, actor: AdAdmin, plan_id: int) -> None:
    plan = ad_dao.get_plan(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    name = plan.name
    ad_dao.delete_plan(db, plan)
    audit_log_service.log(
        db, actor, AdAuditLogAction.PLAN_DELETE, detail=f'Excluiu o plano "{name}"'
    )


def admin_list_campaigns(db: Session, status: str | None) -> list[CampaignAdminOut]:
    return [
        CampaignAdminOut.model_validate(c) for c in ad_dao.list_campaigns(db, status)
    ]


def admin_create_manual_campaign(
    db: Session, admin: AdAdmin, payload: ManualCampaignCreate
) -> CampaignAdminOut:
    """Proposta negociada por fora: o admin define só a parte comercial
    (config + preço, sugerido pela engine ou sobrescrito). Nasce
    `awaiting_content`, sem nenhum criativo — o link do painel do anunciante
    (`access_token`) é o que o admin envia pro anunciante preencher o
    conteúdo (ver `submit_my_campaign_content`), que só então gera o link de
    pagamento real e vira `pending_payment`."""
    targeting = payload.effective_targeting()
    _check_targeting(targeting)
    schedule = payload.schedule or ScheduleIn()
    price_cents = payload.price_cents
    if price_cents is None:
        price_cents = _plan_locked_price(
            db, payload.plan_id, payload.duration_days, payload.formats,
            targeting, schedule, payload.objective, payload.priority,
            payload.per_user_impression_cap,
        )
    if price_cents is None:
        result = _quote_breakdown(
            db,
            formats=payload.formats,
            duration_days=payload.duration_days,
            targeting=targeting,
            schedule=schedule,
            objective=payload.objective,
            priority=payload.priority,
            per_user_impression_cap=payload.per_user_impression_cap,
        )
        price_cents = result["price_cents"]
    renewed_from_id, root_campaign_id = _resolve_renewal(db, payload.renewed_from_token)
    campaign = ad_dao.create_campaign(
        db,
        creatives=[],
        plan_id=payload.plan_id,
        status=AdCampaignStatus.AWAITING_CONTENT,
        advertiser_name=payload.advertiser_name,
        advertiser_email=payload.advertiser_email,
        advertiser_phone=payload.advertiser_phone,
        advertiser_type=payload.advertiser_type,
        advertiser_document=payload.advertiser_document,
        formats=payload.formats,
        price_cents=price_cents,
        targeting=targeting.model_dump(),
        duration_days=payload.duration_days,
        objective=payload.objective,
        priority=payload.priority,
        rotation_weight=payload.rotation_weight,
        per_user_impression_cap=payload.per_user_impression_cap,
        starts_at=payload.starts_at,
        schedule=schedule.model_dump(),
        created_by_admin_id=admin.id,
        payment_provider=PaymentProvider.ASAAS,
        renewed_from_id=renewed_from_id,
        root_campaign_id=root_campaign_id,
    )
    audit_log_service.log(
        db,
        admin,
        AdAuditLogAction.PROPOSAL_CREATE,
        detail=f"Inseriu proposta manual para {payload.advertiser_name} ({payload.advertiser_email})",
    )
    return CampaignAdminOut.model_validate(campaign)


def submit_my_campaign_content(
    db: Session, token: str, payload: CampaignContentSubmit
) -> CheckoutResponse:
    """Anunciante preenche o conteúdo criativo de uma proposta manual ainda
    `awaiting_content` — a config comercial já foi fixada pelo admin na
    criação (ver `admin_create_manual_campaign`). Salva os criativos, gera o
    link de pagamento real só agora (é o primeiro momento em que existe um
    título pra dar nome ao produto no Asaas) e vira `pending_payment`."""
    campaign = ad_dao.get_campaign_by_token(db, token)
    if not campaign:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    if campaign.status != AdCampaignStatus.AWAITING_CONTENT:
        raise HTTPException(
            status_code=400, detail="Este anúncio não está aguardando conteúdo"
        )
    creatives = payload.effective_creatives()
    try:
        _check_map_has_pin(campaign.formats, creatives)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    ad_dao.upsert_creatives_by_format(
        db, campaign, [c.model_dump() for c in creatives]
    )
    title = campaign.creatives[0].title if campaign.creatives else "Anúncio"
    checkout_url = payments.create_checkout_session(
        campaign.id,
        campaign.access_token,
        title,
        campaign.price_cents,
        advertiser_name=campaign.advertiser_name,
        advertiser_email=campaign.advertiser_email,
        advertiser_phone=campaign.advertiser_phone,
        advertiser_document=campaign.advertiser_document,
    )
    campaign = ad_dao.update_campaign(
        db, campaign, status=AdCampaignStatus.PENDING_PAYMENT
    )
    if campaign.created_by_admin_id is not None:
        admin = admin_dao.get_by_id(db, campaign.created_by_admin_id)
        if admin:
            audit_log_service.log(
                db,
                admin,
                AdAuditLogAction.PROPOSAL_CONTENT_SUBMITTED,
                detail=(
                    f"Anunciante {campaign.advertiser_name} "
                    f"({campaign.advertiser_email}) preencheu o conteúdo da proposta"
                ),
            )
    return CheckoutResponse(campaign_id=campaign.id, checkout_url=checkout_url)


def admin_mark_campaign_paid(
    db: Session, actor: AdAdmin, campaign_id: int
) -> CampaignAdminOut:
    """Confirma manualmente o pagamento de uma campanha `pending_payment` —
    pra pagamentos combinados por fora (PIX/transferência) ou pra testar o
    fluxo sem depender de uma chave Asaas real (gap documentado no
    CLAUDE.md). Reaproveita `_activate`, o mesmo caminho do webhook, só
    marcando `payment_provider` como confirmação manual pra auditoria."""
    campaign = ad_dao.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    if campaign.status != AdCampaignStatus.PENDING_PAYMENT:
        raise HTTPException(
            status_code=400, detail="Campanha não está aguardando pagamento"
        )
    _activate(
        db,
        campaign,
        payment_reference=None,
        payment_provider=PaymentProvider.MANUAL_CONFIRMATION,
        actor=actor,
    )
    db.refresh(campaign)
    audit_log_service.log(
        db,
        actor,
        AdAuditLogAction.CAMPAIGN_MARK_PAID,
        detail=(
            f"Marcou como paga a campanha de {campaign.advertiser_name} "
            f"({campaign.advertiser_email})"
        ),
    )
    return CampaignAdminOut.model_validate(campaign)


_CAMPAIGN_FIELD_LABELS = {
    "ends_at": "data de término",
    "priority": "prioridade",
    "per_user_impression_cap": "limite por usuário",
}


def admin_update_campaign(
    db: Session, campaign_id: int, actor: AdAdmin, payload: CampaignUpdate
) -> CampaignAdminOut:
    campaign = ad_dao.get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    new_status = fields.get("status")
    other_fields = {k: v for k, v in fields.items() if k != "status"}
    campaign = ad_dao.update_campaign(db, campaign, **fields)
    # Toda mutação de campanha vira uma entrada de auditoria — pause/reativação
    # ganham uma ação própria (mais legível na lista); qualquer outro campo
    # tocado no mesmo PATCH (prioridade, tetos de impressão, data de término)
    # vira um `CAMPAIGN_UPDATE` genérico descrevendo o que mudou.
    who = f"{campaign.advertiser_name} ({campaign.advertiser_email})"
    if new_status == AdCampaignStatus.PAUSED:
        audit_log_service.log(
            db, actor, AdAuditLogAction.CAMPAIGN_PAUSE, detail=f"Pausou a campanha de {who}"
        )
    elif new_status == AdCampaignStatus.ACTIVE:
        audit_log_service.log(
            db, actor, AdAuditLogAction.CAMPAIGN_REACTIVATE, detail=f"Reativou a campanha de {who}"
        )
    elif new_status is not None:
        audit_log_service.log(
            db,
            actor,
            AdAuditLogAction.CAMPAIGN_UPDATE,
            detail=f"Alterou o status da campanha de {who} para {new_status}",
        )
    if other_fields:
        changes = ", ".join(
            f"{_CAMPAIGN_FIELD_LABELS.get(k, k)} → {v}" for k, v in other_fields.items()
        )
        audit_log_service.log(
            db,
            actor,
            AdAuditLogAction.CAMPAIGN_UPDATE,
            detail=f"Editou a campanha de {who} ({changes})",
        )
    return CampaignAdminOut.model_validate(campaign)


def admin_list_creatives(db: Session, campaign_id: int) -> list[CreativeOut]:
    # Só leitura — o conteúdo criativo é responsabilidade do próprio
    # anunciante (ver update_my_campaign/submit_my_campaign_content); o admin
    # não cria/edita criativo por aqui.
    return [
        CreativeOut.model_validate(c) for c in ad_dao.list_creatives(db, campaign_id)
    ]


def _campaign_analytics(db: Session, campaign: AdCampaign, group_by: str) -> AnalyticsOut:
    events = ad_dao.list_events(db, campaign.id)
    impressions = [e for e in events if e.event_type == AdEventType.IMPRESSION]
    clicks = [e for e in events if e.event_type == AdEventType.CLICK]
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
    family = ad_dao.list_campaign_family(db, campaign.root_campaign_id or campaign.id)
    history = [CampaignHistoryPeriod.model_validate(c) for c in family]
    return MyCampaignOut(
        id=campaign.id,
        status=campaign.status,
        advertiser_name=campaign.advertiser_name,
        advertiser_email=campaign.advertiser_email,
        advertiser_phone=campaign.advertiser_phone,
        advertiser_type=campaign.advertiser_type,
        advertiser_document=campaign.advertiser_document,
        formats=campaign.formats,
        price_cents=campaign.price_cents,
        currency=campaign.currency,
        targeting=campaign.targeting,
        schedule=campaign.schedule,
        objective=campaign.objective,
        priority=campaign.priority,
        rotation_weight=campaign.rotation_weight,
        per_user_impression_cap=campaign.per_user_impression_cap,
        duration_days=campaign.duration_days,
        starts_at=campaign.starts_at,
        ends_at=campaign.ends_at,
        created_at=campaign.created_at,
        creatives=[CreativeOut.model_validate(c) for c in campaign.creatives],
        analytics=analytics,
        history=history,
    )


def update_my_campaign(
    db: Session, token: str, payload: MyCampaignUpdate
) -> MyCampaignOut:
    """Edição de conteúdo pelo próprio anunciante — contato + criativos
    (por-formato). Termos comerciais não passam por aqui (ver MyCampaignUpdate)."""
    campaign = ad_dao.get_campaign_by_token(db, token)
    if not campaign:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    contact = {
        k: v
        for k, v in payload.model_dump(exclude={"creatives"}).items()
        if v is not None
    }
    # Se mudou documento/tipo, revalida (PF→CPF, PJ→CNPJ) e normaliza.
    if contact.get("advertiser_document", "").strip():
        adv_type = contact.get("advertiser_type", campaign.advertiser_type)
        try:
            contact["advertiser_document"] = validate_document(
                adv_type, contact["advertiser_document"]
            )
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e)) from e
    if contact:
        campaign = ad_dao.update_campaign(db, campaign, **contact)
    if payload.creatives is not None:
        creatives = [c.model_dump() for c in payload.creatives]
        ad_dao.upsert_creatives_by_format(db, campaign, creatives)
    return get_my_campaign(db, token, "weekday")


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

    impressions = [e for e in events if e.event_type == AdEventType.IMPRESSION]
    clicks = [e for e in events if e.event_type == AdEventType.CLICK]
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
        active_campaigns=sum(1 for c in campaigns if c.status == AdCampaignStatus.ACTIVE),
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
