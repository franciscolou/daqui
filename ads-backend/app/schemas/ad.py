from datetime import datetime

from pydantic import BaseModel, field_validator, model_validator

from app.core.br_documents import ADVERTISER_TYPES, validate_document
from app.models.ad import (
    AUDIENCES,
    ENGAGEMENT_LEVELS,
    FORMATS,
    OBJECTIVES,
    PACING_MODES,
    STATUSES,
    USER_RECENCIES,
)


def _check_formats(v: list[str]) -> list[str]:
    if not v:
        raise ValueError("Escolha ao menos um formato de anúncio")
    invalid = set(v) - set(FORMATS)
    if invalid:
        raise ValueError(f"Formato(s) inválido(s): {', '.join(sorted(invalid))}")
    return v


def _check_one_of(name: str, choices: tuple[str, ...]):
    def _validate(v: str) -> str:
        if v not in choices:
            raise ValueError(f"{name} inválido: {v}")
        return v

    return _validate


# ── Segmentação e agenda ────────────────────────────────────────────────
class TargetingIn(BaseModel):
    citywide: bool = False
    neighborhoods: list[str] = []
    include_nearby: bool = False
    radius_km: float | None = None
    center_lat: float | None = None
    center_lng: float | None = None
    audience: str = "all"
    categories: list[str] = []
    group_ids: list[int] = []
    user_recency: str = "all"
    engagement: str = "any"

    _validate_audience = field_validator("audience")(
        _check_one_of("audience", AUDIENCES)
    )
    _validate_recency = field_validator("user_recency")(
        _check_one_of("user_recency", USER_RECENCIES)
    )
    _validate_engagement = field_validator("engagement")(
        _check_one_of("engagement", ENGAGEMENT_LEVELS)
    )


class ScheduleIn(BaseModel):
    hours: list[int] | None = None
    days_of_week: list[int] | None = None
    special_dates: list[str] = []


# ── Criativos ────────────────────────────────────────────────────────────
class MediaUploadOut(BaseModel):
    url: str
    type: str  # "image" | "video"


class CreativeIn(BaseModel):
    format: str | None = None
    title: str
    content: str = ""
    image_url: str | None = None
    video_url: str | None = None
    cta_label: str | None = None
    target_url: str
    latitude: float | None = None
    longitude: float | None = None
    linked_user_id: int | None = None
    weight: int = 1

    @field_validator("format")
    @classmethod
    def check_format(cls, v: str | None) -> str | None:
        if v is not None and v not in FORMATS:
            raise ValueError(f"Formato inválido: {v}")
        return v


class CreativeUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    image_url: str | None = None
    video_url: str | None = None
    cta_label: str | None = None
    target_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    linked_user_id: int | None = None
    weight: int | None = None
    is_active: bool | None = None


class CreativeOut(BaseModel):
    id: int
    campaign_id: int
    format: str | None
    title: str
    content: str
    image_url: str | None
    video_url: str | None
    cta_label: str | None
    target_url: str
    latitude: float | None
    longitude: float | None
    linked_user_id: int | None
    weight: int
    is_active: bool
    impressions_count: int
    clicks_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Planos ───────────────────────────────────────────────────────────────
class AdPlanOut(BaseModel):
    id: int
    name: str
    slug: str
    description: str
    price_cents: int
    currency: str
    duration_days: int
    formats: list[str]
    max_neighborhoods: int | None
    is_public: bool
    sort_order: int
    category: str | None
    badge: str | None

    model_config = {"from_attributes": True}


class AdPlanCreate(BaseModel):
    name: str
    slug: str
    description: str = ""
    price_cents: int
    currency: str = "BRL"
    duration_days: int
    formats: list[str]
    max_neighborhoods: int | None = None
    is_public: bool = True
    sort_order: int = 0
    category: str | None = None
    badge: str | None = None

    _validate_formats = field_validator("formats")(_check_formats)


class AdPlanUpdate(BaseModel):
    """Atualização parcial — só os campos enviados (não `None`) são
    alterados, mesma convenção de `CampaignUpdate`/`CreativeUpdate`."""

    name: str | None = None
    slug: str | None = None
    description: str | None = None
    price_cents: int | None = None
    duration_days: int | None = None
    formats: list[str] | None = None
    max_neighborhoods: int | None = None
    is_public: bool | None = None
    sort_order: int | None = None
    category: str | None = None
    badge: str | None = None

    _validate_formats = field_validator("formats")(
        lambda v: _check_formats(v) if v is not None else v
    )


# ── Quote ────────────────────────────────────────────────────────────────
class QuoteRequest(BaseModel):
    # Quando informado, o preço não vem da engine dinâmica de `formats` — vem
    # do preço fixo do plano escalado pra `duration_days` (ver
    # `services/ad.py::_plan_quote_breakdown`), pra cotar em tempo real a
    # duração customizada de um plano contratado.
    plan_id: int | None = None
    formats: list[str]
    duration_days: int
    neighborhoods: list[str] = []
    citywide: bool = False
    targeting: TargetingIn | None = None
    schedule: ScheduleIn | None = None
    objective: str = "clicks"
    priority: int = 3
    daily_impression_cap: int | None = None
    per_user_impression_cap: int | None = None

    _validate_formats = field_validator("formats")(_check_formats)
    _validate_objective = field_validator("objective")(
        _check_one_of("objective", OBJECTIVES)
    )

    @field_validator("priority")
    @classmethod
    def check_priority(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Prioridade deve estar entre 1 e 5")
        return v

    @field_validator("duration_days")
    @classmethod
    def check_duration(cls, v: int) -> int:
        if not 1 <= v <= 720:
            raise ValueError("Duração deve estar entre 1 e 720 dias")
        return v

    def effective_targeting(self) -> TargetingIn:
        if self.targeting is not None:
            return self.targeting.model_copy(
                update={"citywide": self.citywide, "neighborhoods": self.neighborhoods}
            )
        return TargetingIn(citywide=self.citywide, neighborhoods=self.neighborhoods)


class PriceFactor(BaseModel):
    label: str
    multiplier: float


class QuoteResponse(BaseModel):
    price_cents: int
    currency: str = "BRL"
    base_cents: int
    factors: list[PriceFactor]


# ── Campanhas ────────────────────────────────────────────────────────────
class CampaignCreateBase(BaseModel):
    plan_id: int | None = None
    formats: list[str]
    duration_days: int
    neighborhoods: list[str] = []
    citywide: bool = False
    targeting: TargetingIn | None = None
    schedule: ScheduleIn | None = None
    objective: str = "clicks"
    priority: int = 3
    rotation_weight: float = 1.0
    daily_impression_cap: int | None = None
    per_user_impression_cap: int | None = None
    pacing: str = "asap"

    advertiser_name: str
    advertiser_email: str
    advertiser_phone: str = ""
    # Pessoa Física (CPF) ou Jurídica (CNPJ) — validado e normalizado abaixo.
    advertiser_type: str = "individual"
    advertiser_document: str = ""

    # Se preenchido, esta campanha é uma renovação/reativação de uma
    # anterior (identificada pelo access_token dela) — ver
    # services/ad.py::checkout()/admin_create_manual_campaign() pra como
    # renewed_from_id/root_campaign_id são resolvidos a partir daqui.
    renewed_from_token: str | None = None

    # Criativo: aceita uma lista `creatives`, ou (retrocompatibilidade com o
    # app já publicado) os campos soltos de um único criativo.
    creatives: list[CreativeIn] | None = None
    title: str | None = None
    content: str = ""
    image_url: str | None = None
    video_url: str | None = None
    cta_label: str | None = None
    target_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    _validate_formats = field_validator("formats")(_check_formats)
    _validate_objective = field_validator("objective")(
        _check_one_of("objective", OBJECTIVES)
    )
    _validate_pacing = field_validator("pacing")(_check_one_of("pacing", PACING_MODES))

    @field_validator("duration_days")
    @classmethod
    def check_duration(cls, v: int) -> int:
        if not 1 <= v <= 720:
            raise ValueError("Duração deve estar entre 1 e 720 dias")
        return v

    @field_validator("advertiser_type")
    @classmethod
    def check_advertiser_type(cls, v: str) -> str:
        if v not in ADVERTISER_TYPES:
            raise ValueError(f"Tipo de anunciante inválido: {v}")
        return v

    @model_validator(mode="after")
    def check_has_creative(self) -> "CampaignCreateBase":
        if not self.creatives and not (self.title and self.target_url):
            raise ValueError(
                "Informe ao menos um criativo (título + link) ou a lista `creatives`"
            )
        return self

    @model_validator(mode="after")
    def check_document(self) -> "CampaignCreateBase":
        # Valida/normaliza (só dígitos) conforme PF/PJ. Documento vazio é aceito
        # aqui (o admin pode inserir uma proposta antes de ter o CPF/CNPJ) — a
        # obrigatoriedade no fluxo self-service é garantida no checkout do app.
        if self.advertiser_document.strip():
            self.advertiser_document = validate_document(
                self.advertiser_type, self.advertiser_document
            )
        else:
            self.advertiser_document = ""
        return self

    def effective_targeting(self) -> TargetingIn:
        # `citywide`/`neighborhoods` soltos continuam sendo a fonte de
        # verdade (mesmos campos de sempre); `targeting`, quando enviado,
        # só acrescenta os eixos extras — evita ambiguidade entre os dois.
        if self.targeting is not None:
            return self.targeting.model_copy(
                update={"citywide": self.citywide, "neighborhoods": self.neighborhoods}
            )
        return TargetingIn(citywide=self.citywide, neighborhoods=self.neighborhoods)

    def effective_creatives(self) -> list[CreativeIn]:
        if self.creatives:
            return self.creatives
        return [
            CreativeIn(
                title=self.title or "",
                content=self.content,
                image_url=self.image_url,
                video_url=self.video_url,
                cta_label=self.cta_label,
                target_url=self.target_url or "",
                latitude=self.latitude,
                longitude=self.longitude,
            )
        ]


class CheckoutRequest(CampaignCreateBase):
    """Contratação self-service: preço sempre calculado pela engine de precificação."""


class CheckoutResponse(BaseModel):
    campaign_id: int
    checkout_url: str


class ManualCampaignCreate(CampaignCreateBase):
    """Proposta negociada por fora (Instagram/WhatsApp/Gmail), inserida manualmente
    pelo time de anúncios. Nasce `pending_payment` como o checkout self-service —
    o admin pode sobrescrever o preço sugerido pela engine, mas a ativação só
    acontece via link de pagamento ou confirmação manual (ver
    services/ad.py::admin_mark_campaign_paid)."""

    price_cents: int | None = None


class CampaignUpdate(BaseModel):
    status: str | None = None
    ends_at: datetime | None = None
    priority: int | None = None
    daily_impression_cap: int | None = None
    per_user_impression_cap: int | None = None

    @field_validator("status")
    @classmethod
    def check_status(cls, v: str | None) -> str | None:
        if v is not None and v not in STATUSES:
            raise ValueError(f"Status inválido: {v}")
        return v


class CampaignAdminOut(BaseModel):
    id: int
    plan_id: int | None
    status: str
    access_token: str
    advertiser_name: str
    advertiser_email: str
    advertiser_phone: str
    advertiser_type: str
    advertiser_document: str
    formats: list[str]
    price_cents: int
    currency: str
    targeting: TargetingIn
    schedule: ScheduleIn
    objective: str
    priority: int
    rotation_weight: float
    daily_impression_cap: int | None
    per_user_impression_cap: int | None
    pacing: str
    duration_days: int
    starts_at: datetime | None
    ends_at: datetime | None
    payment_provider: str | None
    renewed_from_id: int | None
    root_campaign_id: int | None
    impressions_count: int
    clicks_count: int
    created_at: datetime
    updated_at: datetime
    creatives: list[CreativeOut]

    model_config = {"from_attributes": True}


class ManualCampaignCreateOut(BaseModel):
    """Resposta da criação manual: a campanha nasce `pending_payment` e um
    link de pagamento real já é gerado (ver services/ad.py::admin_create_manual_campaign)
    — o admin copia/envia esse link, ou usa "Marcar como paga" (mark-paid)
    pra confirmar um pagamento combinado por fora / testar sem Stripe real."""

    campaign: CampaignAdminOut
    checkout_url: str


class AdOut(BaseModel):
    """Formato público, enxuto — é o que cada tela do app Daqui recebe.
    Monta-se a partir da campanha escolhida + do criativo sorteado (ver
    `services/ad.py::get_active_ad`), não mais direto de um único registro.
    """

    id: int
    creative_id: int
    objective: str
    title: str
    content: str
    image_url: str | None
    video_url: str | None
    cta_label: str | None
    target_url: str
    latitude: float | None
    longitude: float | None
    linked_user_id: int | None


class ClickIn(BaseModel):
    viewer_id: str | None = None
    creative_id: int | None = None
    format: str | None = None
    objective_action: str | None = None


# ── Analytics ────────────────────────────────────────────────────────────
class AnalyticsSummary(BaseModel):
    impressions: int
    clicks: int
    ctr: float
    cpc_cents: float | None
    cpm_cents: float | None


class AnalyticsBucket(BaseModel):
    key: str
    impressions: int
    clicks: int
    ctr: float


class AnalyticsOut(BaseModel):
    summary: AnalyticsSummary
    buckets: list[AnalyticsBucket]
    actions: dict[str, int]


# ── Painel do anunciante (público, autenticado só pelo access_token) ─────
class CampaignHistoryPeriod(BaseModel):
    """Um período da "família" de renovações de uma campanha (ver
    daos/ad.py::list_campaign_family) — resultados resumidos de cada vez que
    ela esteve ativa, incluindo o período atualmente visualizado."""

    id: int
    access_token: str
    status: str
    starts_at: datetime | None
    ends_at: datetime | None
    created_at: datetime
    impressions_count: int
    clicks_count: int
    price_cents: int

    model_config = {"from_attributes": True}


class MyCampaignUpdate(BaseModel):
    """Edição de conteúdo pelo próprio anunciante (via access_token) — só
    contato + criativos. Termos comerciais (preço/duração/segmentação/
    formatos) continuam fixos após a compra, editáveis só pelo admin."""

    advertiser_name: str | None = None
    advertiser_email: str | None = None
    advertiser_phone: str | None = None
    advertiser_type: str | None = None
    advertiser_document: str | None = None
    creatives: list[CreativeIn] | None = None

    @field_validator("advertiser_type")
    @classmethod
    def check_advertiser_type(cls, v: str | None) -> str | None:
        if v is not None and v not in ADVERTISER_TYPES:
            raise ValueError(f"Tipo de anunciante inválido: {v}")
        return v


class MyCampaignOut(BaseModel):
    """O que o próprio anunciante vê em `/anunciar/painel/{token}` — mesmos
    dados de `CampaignAdminOut` + analytics + histórico de renovações, mas
    sem `access_token` (o token já está na URL, não precisa voltar no corpo)
    nem nada de outras campanhas."""

    id: int
    status: str
    advertiser_name: str
    advertiser_email: str
    advertiser_phone: str
    advertiser_type: str
    advertiser_document: str
    formats: list[str]
    price_cents: int
    currency: str
    targeting: TargetingIn
    schedule: ScheduleIn
    objective: str
    priority: int
    rotation_weight: float
    pacing: str
    daily_impression_cap: int | None
    per_user_impression_cap: int | None
    duration_days: int
    starts_at: datetime | None
    ends_at: datetime | None
    created_at: datetime
    creatives: list[CreativeOut]
    analytics: AnalyticsOut
    history: list[CampaignHistoryPeriod]


# ── Analytics agregado (visão do time de anúncios, todas as campanhas —
# reaproveitado também pelo painel "Meus anúncios" do próprio anunciante,
# ver `services/ad.py::get_my_campaigns_analytics`) ────────────────────
class CampaignAnalyticsRow(BaseModel):
    id: int
    access_token: str
    title: str
    advertiser_name: str
    advertiser_email: str
    status: str
    objective: str
    category: str
    formats: list[str]
    price_cents: int
    impressions: int
    clicks: int
    ctr: float
    cpc_cents: float | None
    starts_at: datetime | None
    ends_at: datetime | None
    created_at: datetime


class GlobalAnalyticsSummary(BaseModel):
    campaigns_count: int
    active_campaigns: int
    impressions: int
    clicks: int
    ctr: float
    revenue_cents: int
    cpc_cents: float | None
    cpm_cents: float | None


class GlobalAnalyticsOut(BaseModel):
    date_from: datetime | None
    date_to: datetime | None
    summary: GlobalAnalyticsSummary
    timeseries: list[AnalyticsBucket]
    by_format: list[AnalyticsBucket]
    by_objective: list[AnalyticsBucket]
    by_category: list[AnalyticsBucket]
    top_neighborhoods: list[AnalyticsBucket]
    campaigns: list[CampaignAnalyticsRow]
    advertisers: list[str]
    insights: list[str]


class HasCampaignsOut(BaseModel):
    has_campaigns: bool
