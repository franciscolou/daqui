import secrets
from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.br_documents import AdvertiserType
from app.database import Base


class AdFormat(StrEnum):
    """Os 5 formatos em que um anúncio pode aparecer no app Daqui. POST (card
    no feed) e MAP (pin no mapa) são independentes: quem anuncia algo sem
    endereço (um app, uma loja online) contrata só POST; quem só quer marcar
    presença num ponto contrata só MAP. Escolher os dois juntos sai mais barato
    que a soma (ver `POST_MAP_BUNDLE_DISCOUNT` em services/ad_pricing.py)."""

    POST = "post"
    MAP = "map"
    CONVERSATION = "conversation"
    NOTIFICATION = "notification"
    SEARCH_POSTER = "search_poster"


class AdCampaignStatus(StrEnum):
    AWAITING_CONTENT = "awaiting_content"
    PENDING_PAYMENT = "pending_payment"
    ACTIVE = "active"
    PAUSED = "paused"
    EXPIRED = "expired"
    REJECTED = "rejected"


class AdObjective(StrEnum):
    """Objetivo da campanha: define o CTA/ação em destaque, a métrica-alvo no
    analytics e um fator leve de precificação (ver services/ad_pricing.py)."""

    REACH = "reach"
    CLICKS = "clicks"
    PROFILE_VISITS = "profile_visits"
    MAP_OPENS = "map_opens"
    WHATSAPP_OPENS = "whatsapp_opens"
    INSTAGRAM_OPENS = "instagram_opens"
    WEBSITE_OPENS = "website_opens"


DEFAULT_OBJECTIVE = AdObjective.CLICKS


class AdPacing(StrEnum):
    ASAP = "asap"
    EVEN = "even"


class Audience(StrEnum):
    ALL = "all"
    RESIDENTS = "residents"
    VISITORS = "visitors"


class UserRecency(StrEnum):
    ALL = "all"
    NEW = "new"
    RETURNING = "returning"


class EngagementLevel(StrEnum):
    ANY = "any"
    ACTIVE = "active"


class GeoScope(StrEnum):
    """Escopo geográfico de uma campanha (ou de um plano — ver AdPlan.geo_scope):
    do mais estreito ao mais amplo. NEIGHBORHOOD usa `neighborhoods` (lista de
    bairros), CITYWIDE usa `city` (uma cidade inteira), CITIES usa `cities`
    (lista de cidades específicas — ex.: capitais de vários estados) e COUNTRY
    não precisa de nenhum campo extra (Brasil todo, o app é só nacional)."""

    NEIGHBORHOOD = "neighborhood"
    CITYWIDE = "citywide"
    CITIES = "cities"
    COUNTRY = "country"


class AdEventType(StrEnum):
    IMPRESSION = "impression"
    CLICK = "click"


class ObjectiveAction(StrEnum):
    """Ações específicas logadas num clique — usadas pra medir objetivos como
    "abertura do WhatsApp/Instagram/site" (ver "Objetivo da campanha" no plano)."""

    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"
    WEBSITE = "website"
    MAP = "map"
    PROFILE = "profile"


class AdPlanCategory(StrEnum):
    """Agrupamento na tela de anúncios — puramente de apresentação, não afeta
    preço/entrega. Mesmos valores de `AdPlanCategory` no frontend
    (`lib/adsApi.ts`)."""

    LOCAL_BUSINESS = "local_business"
    EVENT = "event"
    ENTERPRISE = "enterprise"
    NATIONAL = "national"


class PaymentProvider(StrEnum):
    STRIPE = "stripe"
    MANUAL = "manual"
    MANUAL_CONFIRMATION = "manual_confirmation"


def default_targeting() -> dict:
    """Alvo de audiência: bloco único em JSON (mesmo idioma de `formats`),
    pra não exigir migração a cada novo eixo de segmentação. `geo_scope`
    decide qual dos 3 campos de área (`neighborhoods`/`city`/`cities`) vale —
    ver GeoScope.
    """
    return {
        "geo_scope": GeoScope.NEIGHBORHOOD,
        "neighborhoods": [],
        "city": None,
        "cities": [],
        "include_nearby": False,
        "radius_km": None,
        "center_lat": None,
        "center_lng": None,
        "audience": Audience.ALL,
        "categories": [],
        "group_ids": [],
        "user_recency": UserRecency.ALL,
        "engagement": EngagementLevel.ANY,
    }


def default_schedule() -> dict:
    """`null`/campos `null` = sempre — comportamento de hoje (sem agenda)."""
    return {"hours": None, "days_of_week": None, "special_dates": []}


class AdPlan(Base):
    """Plano predefinido, oferecido no seletor de planos do anunciante.
    Preço fixo definido pelo admin — não passa pela engine dinâmica.
    """

    __tablename__ = "ad_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(120), unique=True, index=True, nullable=False
    )
    description: Mapped[str] = mapped_column(Text, default="")
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="BRL")
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    formats: Mapped[list[str]] = mapped_column(JSON, default=list)
    # Escopo geográfico fixo do plano (ver GeoScope) — decide qual dos 2
    # campos abaixo vale: "neighborhood" usa `max_neighborhoods` (limite de
    # bairros que o anunciante escolhe), "cities" usa `max_cities` (limite de
    # cidades). "citywide" e "country" não usam nenhum dos dois (o anunciante
    # só escolhe QUAL cidade, no caso de "citywide" — ver targeting da campanha).
    geo_scope: Mapped[GeoScope] = mapped_column(
        String(20), default=GeoScope.NEIGHBORHOOD, nullable=False
    )
    max_neighborhoods: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_cities: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    category: Mapped[AdPlanCategory | None] = mapped_column(String(30), nullable=True)
    # Texto curto de destaque (ex. "Mais popular"), opcional.
    badge: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    campaigns: Mapped[list["AdCampaign"]] = relationship(
        "AdCampaign", back_populates="plan"
    )


class AdCampaign(Base):
    """Uma campanha real: contratada via checkout self-service ou inserida
    manualmente pelo time de anúncios a partir de uma proposta negociada.

    Não carrega mais o criativo (título/imagem/link) — isso vive em
    `AdCreative` (1:N), permitindo múltiplos criativos/teste A-B por campanha.
    """

    __tablename__ = "ad_campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    plan_id: Mapped[int | None] = mapped_column(
        ForeignKey("ad_plans.id"), nullable=True
    )
    status: Mapped[AdCampaignStatus] = mapped_column(
        String(20), default=AdCampaignStatus.PENDING_PAYMENT, nullable=False
    )

    advertiser_name: Mapped[str] = mapped_column(String(120), nullable=False)
    advertiser_email: Mapped[str] = mapped_column(String(255), nullable=False)
    advertiser_phone: Mapped[str] = mapped_column(String(30), default="")
    # Pessoa Física (CPF) ou Jurídica (CNPJ) — ver core/br_documents.py.
    # `advertiser_document` guarda só os dígitos, já validados no checkout.
    advertiser_type: Mapped[AdvertiserType] = mapped_column(
        String(20), default=AdvertiserType.INDIVIDUAL, nullable=False
    )
    advertiser_document: Mapped[str] = mapped_column(String(20), default="")

    # Link de acesso do anunciante ao próprio painel (`/advertise/dashboard/{token}`,
    # ver routers/ads.py::"/my-campaign/{token}") — capability token em vez de
    # login, já que não existe conta de anunciante neste sistema. Único segredo
    # que dá acesso; nunca reexposto em nenhuma resposta pública além desta.
    access_token: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, default=lambda: secrets.token_urlsafe(24)
    )

    formats: Mapped[list[str]] = mapped_column(JSON, default=list)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="BRL")

    # Segmentação: bloco único (ver `default_targeting`). Contém, entre
    # outros, `neighborhoods`/`citywide` — expostos também como propriedades
    # de conveniência abaixo, usadas pelo filtro de elegibilidade já existente.
    targeting: Mapped[dict] = mapped_column(JSON, default=default_targeting)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)

    # Objetivo, prioridade e controle de entrega.
    objective: Mapped[AdObjective] = mapped_column(
        String(30), default=DEFAULT_OBJECTIVE, nullable=False
    )
    priority: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    rotation_weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    daily_impression_cap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    per_user_impression_cap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pacing: Mapped[AdPacing] = mapped_column(String(10), default=AdPacing.ASAP, nullable=False)
    schedule: Mapped[dict] = mapped_column(JSON, default=default_schedule)

    starts_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_by_admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("ad_admins.id"), nullable=True
    )

    # Cadeia de renovação: "reativar" uma campanha cria uma NOVA linha (novo
    # período, novo access_token) apontando pra anterior via renewed_from_id.
    # root_campaign_id sempre resolve pro ancestral mais antigo da cadeia
    # (== o próprio id se nunca foi renovada) — permite buscar "todos os
    # períodos da família" com um WHERE plano em vez de recursão (ver
    # daos/ad.py::list_campaign_family).
    renewed_from_id: Mapped[int | None] = mapped_column(
        ForeignKey("ad_campaigns.id"), nullable=True, index=True
    )
    root_campaign_id: Mapped[int | None] = mapped_column(
        ForeignKey("ad_campaigns.id"), nullable=True, index=True
    )

    payment_provider: Mapped[PaymentProvider | None] = mapped_column(String(30), nullable=True)
    payment_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    impressions_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    clicks_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_served_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    plan: Mapped["AdPlan | None"] = relationship("AdPlan", back_populates="campaigns")
    creatives: Mapped[list["AdCreative"]] = relationship(
        "AdCreative", back_populates="campaign", cascade="all, delete-orphan"
    )

    # Propriedades de conveniência: leem dentro de `targeting`, para não
    # espalhar `campaign.targeting["neighborhoods"]` pelo código todo — o
    # filtro de elegibilidade (`daos/ad.py`) e a precificação continuam
    # lendo `campaign.geo_scope`/`campaign.neighborhoods`/etc como antes.
    @property
    def geo_scope(self) -> GeoScope:
        return self.targeting.get("geo_scope", GeoScope.NEIGHBORHOOD)

    @property
    def neighborhoods(self) -> list[str]:
        return self.targeting.get("neighborhoods", [])

    @property
    def city(self) -> str | None:
        return self.targeting.get("city")

    @property
    def cities(self) -> list[str]:
        return self.targeting.get("cities", [])


class AdCreative(Base):
    """Um criativo (título/texto/imagem/CTA/link) associado a uma campanha.
    `format=None` serve qualquer formato da campanha; um valor específico
    sobrepõe o criativo padrão só para aquele formato (ex.: imagem diferente
    no poster de busca). Múltiplos criativos do mesmo escopo com `weight`
    distintos formam um teste A/B.
    """

    __tablename__ = "ad_creatives"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("ad_campaigns.id"), nullable=False, index=True
    )
    format: Mapped[AdFormat | None] = mapped_column(String(20), nullable=True)

    title: Mapped[str] = mapped_column(String(120), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cta_label: Mapped[str | None] = mapped_column(String(60), nullable=True)
    target_url: Mapped[str] = mapped_column(String(500), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Conta do Daqui vinculada (só faz sentido no formato "post"): id de
    # User em backend/ — banco separado, zero cross-import, então esse valor
    # é opaco aqui e nunca validado; só é ecoado no AdOut/CreativeOut pro
    # frontend resolver via api.getUser(id) e renderizar como post real.
    linked_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    weight: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    impressions_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    clicks_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    campaign: Mapped["AdCampaign"] = relationship(
        "AdCampaign", back_populates="creatives"
    )


class AdEvent(Base):
    """Log de impressões/cliques — fonte de verdade para caps de entrega
    (diário / por usuário) e para analytics (CTR, CPC, CPM, melhor
    horário/bairro, heatmap). Os contadores denormalizados em `AdCampaign`/
    `AdCreative` continuam existindo como cache rápido pras listagens.
    """

    __tablename__ = "ad_events"
    __table_args__ = (
        Index("ix_ad_events_campaign_time", "campaign_id", "occurred_at"),
        Index("ix_ad_events_campaign_viewer", "campaign_id", "viewer_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("ad_campaigns.id"), nullable=False, index=True
    )
    creative_id: Mapped[int | None] = mapped_column(
        ForeignKey("ad_creatives.id"), nullable=True
    )
    event_type: Mapped[AdEventType] = mapped_column(String(12), nullable=False)
    format: Mapped[AdFormat] = mapped_column(String(20), nullable=False)
    neighborhood: Mapped[str | None] = mapped_column(String(120), nullable=True)
    viewer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    objective_action: Mapped[ObjectiveAction | None] = mapped_column(String(20), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
