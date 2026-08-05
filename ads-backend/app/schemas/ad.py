from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, field_validator, model_validator

from app.core.br_documents import AdvertiserType, validate_document
from app.core.uploads import MediaType
from app.models.ad import (
    AdCampaignStatus,
    AdFormat,
    AdObjective,
    AdPlanCategory,
    Audience,
    EngagementLevel,
    GeoScope,
    ObjectiveAction,
    PaymentProvider,
    UserRecency,
)


def _check_formats(v: list[AdFormat]) -> list[AdFormat]:
    if not v:
        raise ValueError("Escolha ao menos um formato de anúncio")
    return v


# ── Segmentação e agenda ────────────────────────────────────────────────
class TargetingIn(BaseModel):
    # Escopo geográfico (ver GeoScope): decide qual dos 3 campos de área
    # abaixo vale — `neighborhoods` (NEIGHBORHOOD), `city` (CITYWIDE) ou
    # `cities` (CITIES); COUNTRY não usa nenhum dos três.
    geo_scope: GeoScope = GeoScope.NEIGHBORHOOD
    neighborhoods: list[str] = []
    city: str | None = None
    cities: list[str] = []
    include_nearby: bool = False
    radius_km: float | None = None
    center_lat: float | None = None
    center_lng: float | None = None
    audience: Audience = Audience.ALL
    categories: list[str] = []
    group_ids: list[int] = []
    user_recency: UserRecency = UserRecency.ALL
    engagement: EngagementLevel = EngagementLevel.ANY


class ScheduleIn(BaseModel):
    hours: list[int] | None = None
    days_of_week: list[int] | None = None
    special_dates: list[str] = []

    @field_validator("special_dates")
    @classmethod
    def check_special_dates_format(cls, v: list[str]) -> list[str]:
        for d in v:
            try:
                datetime.strptime(d, "%Y-%m-%d")
            except ValueError as e:
                raise ValueError(f"Data especial inválida: {d!r} (use AAAA-MM-DD)") from e
        return v


# ── Criativos ────────────────────────────────────────────────────────────
class MediaUploadOut(BaseModel):
    url: str
    type: MediaType


class CreativeIn(BaseModel):
    format: AdFormat | None = None
    title: str
    content: str = ""
    image_url: str | None = None
    video_url: str | None = None
    cta_label: str | None = None
    target_url: str
    latitude: float | None = None
    longitude: float | None = None
    linked_user_id: int | None = None


class CreativeOut(BaseModel):
    id: int
    campaign_id: int
    format: AdFormat | None
    title: str
    content: str
    image_url: str | None
    video_url: str | None
    cta_label: str | None
    target_url: str
    latitude: float | None
    longitude: float | None
    linked_user_id: int | None
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
    formats: list[AdFormat]
    geo_scope: GeoScope
    max_neighborhoods: int | None
    max_cities: int | None
    is_public: bool
    sort_order: int
    category: AdPlanCategory | None
    badge: str | None

    model_config = {"from_attributes": True}


class AdPlanCreate(BaseModel):
    name: str
    slug: str
    description: str = ""
    price_cents: int
    currency: str = "BRL"
    duration_days: int
    formats: list[AdFormat]
    geo_scope: GeoScope = GeoScope.NEIGHBORHOOD
    max_neighborhoods: int | None = None
    max_cities: int | None = None
    is_public: bool = True
    sort_order: int = 0
    category: AdPlanCategory | None = None
    badge: str | None = None

    _validate_formats = field_validator("formats")(_check_formats)


class AdPlanUpdate(BaseModel):
    """Atualização parcial — só os campos enviados (não `None`) são
    alterados, mesma convenção de `CampaignUpdate`."""

    name: str | None = None
    slug: str | None = None
    description: str | None = None
    price_cents: int | None = None
    duration_days: int | None = None
    formats: list[AdFormat] | None = None
    geo_scope: GeoScope | None = None
    max_neighborhoods: int | None = None
    max_cities: int | None = None
    is_public: bool | None = None
    sort_order: int | None = None
    category: AdPlanCategory | None = None
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
    formats: list[AdFormat]
    duration_days: int
    geo_scope: GeoScope = GeoScope.NEIGHBORHOOD
    neighborhoods: list[str] = []
    city: str | None = None
    cities: list[str] = []
    targeting: TargetingIn | None = None
    schedule: ScheduleIn | None = None
    objective: AdObjective = AdObjective.CLICKS
    priority: int = 3
    per_user_impression_cap: int | None = None

    _validate_formats = field_validator("formats")(_check_formats)

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
        # `geo_scope`/`neighborhoods`/`city`/`cities` soltos continuam sendo a
        # fonte de verdade (mesma convenção de sempre); `targeting`, quando
        # enviado, só acrescenta os eixos extras — evita ambiguidade entre os
        # dois. Reconstrói (em vez de `model_copy`, que não revalida) para que
        # um `geo_scope` inválido seja pego aqui, não só na checagem de negócio.
        overrides = {
            "geo_scope": self.geo_scope,
            "neighborhoods": self.neighborhoods,
            "city": self.city,
            "cities": self.cities,
        }
        if self.targeting is not None:
            return TargetingIn(**{**self.targeting.model_dump(), **overrides})
        return TargetingIn(**overrides)


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
    """Configuração comercial + identidade do anunciante — sem nada de
    criativo (ver `CreativeFieldsMixin`). É tudo que uma proposta manual
    precisa na criação (ver `ManualCampaignCreate`); o checkout self-service
    (`CheckoutRequest`) soma o mixin de criativo por cima, já que ali o
    anunciante preenche tudo de uma vez."""

    plan_id: int | None = None
    formats: list[AdFormat]
    duration_days: int
    geo_scope: GeoScope = GeoScope.NEIGHBORHOOD
    neighborhoods: list[str] = []
    city: str | None = None
    cities: list[str] = []
    targeting: TargetingIn | None = None
    schedule: ScheduleIn | None = None
    objective: AdObjective = AdObjective.CLICKS
    priority: int = 3
    rotation_weight: float = 1.0
    per_user_impression_cap: int | None = None
    # Quando informado, a campanha só começa a rodar (e a duração só passa a
    # contar) a partir desta data — ver `services/ad.py::_activate`. `None`
    # (padrão) = imediatamente, assim que o pagamento confirmar.
    starts_at: datetime | None = None

    advertiser_name: str
    advertiser_email: str
    advertiser_phone: str = ""
    # Pessoa Física (CPF) ou Jurídica (CNPJ) — validado e normalizado abaixo.
    advertiser_type: AdvertiserType = AdvertiserType.INDIVIDUAL
    advertiser_document: str = ""

    # Se preenchido, esta campanha é uma renovação/reativação de uma
    # anterior (identificada pelo access_token dela) — ver
    # services/ad.py::checkout()/admin_create_manual_campaign() pra como
    # renewed_from_id/root_campaign_id são resolvidos a partir daqui.
    renewed_from_token: str | None = None

    _validate_formats = field_validator("formats")(_check_formats)

    @field_validator("duration_days")
    @classmethod
    def check_duration(cls, v: int) -> int:
        if not 1 <= v <= 720:
            raise ValueError("Duração deve estar entre 1 e 720 dias")
        return v

    @field_validator("starts_at")
    @classmethod
    def check_starts_at(cls, v: datetime | None) -> datetime | None:
        # Compara só a data (não o instante exato) — quem escolhe "hoje" não
        # pode cair pro passado só porque o relógio já passou da meia-noite
        # entre o clique e a chegada no servidor.
        if v is not None and v.date() < datetime.now(timezone.utc).date():
            raise ValueError("Data de início não pode ser no passado")
        return v

    @model_validator(mode="after")
    def check_special_dates_window(self) -> "CampaignCreateBase":
        # `special_dates`, quando preenchido, SUBSTITUI horário/dia da semana
        # como filtro de exibição (ver `daos/ad.py::_matches_schedule`) — o
        # anúncio só roda nos dias escolhidos, nunca fora deles. Uma data fora
        # do período real da campanha (início escolhido, ou hoje quando
        # imediato, até início + duração) faz esse dia nunca coincidir com a
        # janela em que a campanha está ativa: o anunciante paga o prêmio de
        # sazonalidade por um dia que o anúncio jamais vai exibir.
        dates = (self.schedule.special_dates if self.schedule else None) or []
        if not dates:
            return self
        start = (self.starts_at or datetime.now(timezone.utc)).date()
        end = start + timedelta(days=self.duration_days - 1)
        out_of_range = [d for d in dates if not (start.isoformat() <= d <= end.isoformat())]
        if out_of_range:
            raise ValueError(
                f"Datas especiais fora do período da campanha ({start.isoformat()} a "
                f"{end.isoformat()}): {', '.join(out_of_range)}"
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
        # Mesma convenção de `QuoteRequest.effective_targeting` (ver lá).
        overrides = {
            "geo_scope": self.geo_scope,
            "neighborhoods": self.neighborhoods,
            "city": self.city,
            "cities": self.cities,
        }
        if self.targeting is not None:
            return TargetingIn(**{**self.targeting.model_dump(), **overrides})
        return TargetingIn(**overrides)


class CreativeFieldsMixin(BaseModel):
    """Conteúdo criativo de uma campanha: aceita uma lista `creatives`, ou
    (retrocompatibilidade com o app já publicado) os campos soltos de um
    único criativo. Usado tanto pelo checkout self-service (`CheckoutRequest`,
    que soma isso à config em `CampaignCreateBase` porque ali o anunciante
    preenche tudo de uma vez) quanto pelo preenchimento de conteúdo de uma
    proposta manual (`CampaignContentSubmit`, ver
    services/ad.py::submit_my_campaign_content)."""

    creatives: list[CreativeIn] | None = None
    title: str | None = None
    content: str = ""
    image_url: str | None = None
    video_url: str | None = None
    cta_label: str | None = None
    target_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    @model_validator(mode="after")
    def check_has_creative(self) -> "CreativeFieldsMixin":
        if not self.creatives and not (self.title and self.target_url):
            raise ValueError(
                "Informe ao menos um criativo (título + link) ou a lista `creatives`"
            )
        return self

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


def _check_map_has_pin(formats: list[AdFormat], creatives: list[CreativeIn]) -> None:
    # O formato "mapa" existe justamente pra virar um pin — sem coordenadas
    # em nenhum criativo ele nunca apareceria pra ninguém (ver
    # `daos/ad.py::_candidates_for_format`). Barra na entrada em vez de
    # aceitar uma campanha paga que não entrega nada.
    if AdFormat.MAP in formats and not any(
        c.latitude is not None and c.longitude is not None for c in creatives
    ):
        raise ValueError("Marque o local do pin para anunciar no mapa")


class CheckoutRequest(CampaignCreateBase, CreativeFieldsMixin):
    """Contratação self-service: preço sempre calculado pela engine de
    precificação, criativo preenchido junto com a config (uma tela só)."""

    @model_validator(mode="after")
    def check_map_has_pin(self) -> "CheckoutRequest":
        _check_map_has_pin(self.formats, self.effective_creatives())
        return self


class CheckoutResponse(BaseModel):
    campaign_id: int
    checkout_url: str


class ManualCampaignCreate(CampaignCreateBase):
    """Proposta negociada por fora (Instagram/WhatsApp/Gmail), inserida manualmente
    pelo time de anúncios. Nasce `awaiting_content` (sem nenhum criativo) — o
    admin define só a parte comercial (config + preço, que pode sobrescrever o
    sugerido pela engine); o conteúdo criativo é preenchido depois pelo próprio
    anunciante (ver `CampaignContentSubmit` e
    services/ad.py::submit_my_campaign_content), e só então a campanha vira
    `pending_payment` com um link de pagamento real."""

    price_cents: int | None = None


class CampaignContentSubmit(CreativeFieldsMixin):
    """Conteúdo criativo preenchido pelo próprio anunciante pra uma proposta
    manual ainda `awaiting_content` (ver
    services/ad.py::submit_my_campaign_content) — a config comercial (incluindo
    `formats`) já foi fixada pelo admin na criação da proposta e não é
    reeditável por aqui; a checagem de pin do formato "mapa" usa os formatos
    já salvos na campanha, não um valor reenviado pelo cliente."""


class CampaignUpdate(BaseModel):
    status: AdCampaignStatus | None = None
    ends_at: datetime | None = None
    priority: int | None = None
    per_user_impression_cap: int | None = None


class CampaignAdminOut(BaseModel):
    id: int
    plan_id: int | None
    status: AdCampaignStatus
    access_token: str
    advertiser_name: str
    advertiser_email: str
    advertiser_phone: str
    advertiser_type: AdvertiserType
    advertiser_document: str
    formats: list[AdFormat]
    price_cents: int
    currency: str
    targeting: TargetingIn
    schedule: ScheduleIn
    objective: AdObjective
    priority: int
    rotation_weight: float
    per_user_impression_cap: int | None
    duration_days: int
    starts_at: datetime | None
    ends_at: datetime | None
    payment_provider: PaymentProvider | None
    renewed_from_id: int | None
    root_campaign_id: int | None
    impressions_count: int
    clicks_count: int
    created_at: datetime
    updated_at: datetime
    creatives: list[CreativeOut]

    model_config = {"from_attributes": True}




class AdOut(BaseModel):
    """Formato público, enxuto — é o que cada tela do app Daqui recebe.
    Monta-se a partir da campanha escolhida + do criativo sorteado (ver
    `services/ad.py::get_active_ad`), não mais direto de um único registro.
    """

    id: int
    creative_id: int
    objective: AdObjective
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
    format: AdFormat | None = None
    objective_action: ObjectiveAction | None = None


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
    status: AdCampaignStatus
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
    advertiser_type: AdvertiserType | None = None
    advertiser_document: str | None = None
    creatives: list[CreativeIn] | None = None


class MyCampaignOut(BaseModel):
    """O que o próprio anunciante vê em `/advertise/dashboard/{token}` — mesmos
    dados de `CampaignAdminOut` + analytics + histórico de renovações, mas
    sem `access_token` (o token já está na URL, não precisa voltar no corpo)
    nem nada de outras campanhas."""

    id: int
    status: AdCampaignStatus
    advertiser_name: str
    advertiser_email: str
    advertiser_phone: str
    advertiser_type: AdvertiserType
    advertiser_document: str
    formats: list[AdFormat]
    price_cents: int
    currency: str
    targeting: TargetingIn
    schedule: ScheduleIn
    objective: AdObjective
    priority: int
    rotation_weight: float
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
    status: AdCampaignStatus
    objective: AdObjective
    category: str
    formats: list[AdFormat]
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
