import secrets
from datetime import datetime, timezone

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

from app.database import Base

# Os 4 formatos em que um anúncio pode aparecer no app Daqui. "post" cobre
# tanto o card no feed quanto o pin no mapa (mesmo anúncio, mesma lat/lng) —
# não existe um formato "map" separado.
FORMATS = ("post", "conversation", "notification", "search_poster")

STATUS_PENDING_PAYMENT = "pending_payment"
STATUS_ACTIVE = "active"
STATUS_PAUSED = "paused"
STATUS_EXPIRED = "expired"
STATUS_REJECTED = "rejected"
STATUSES = (
    STATUS_PENDING_PAYMENT,
    STATUS_ACTIVE,
    STATUS_PAUSED,
    STATUS_EXPIRED,
    STATUS_REJECTED,
)

# Objetivo da campanha: define o CTA/ação em destaque, a métrica-alvo no
# analytics e um fator leve de precificação (ver services/ad_pricing.py).
OBJECTIVES = (
    "reach",
    "clicks",
    "profile_visits",
    "map_opens",
    "whatsapp_opens",
    "instagram_opens",
    "website_opens",
)
DEFAULT_OBJECTIVE = "clicks"

PACING_ASAP = "asap"
PACING_EVEN = "even"
PACING_MODES = (PACING_ASAP, PACING_EVEN)

AUDIENCES = ("all", "residents", "visitors")
USER_RECENCIES = ("all", "new", "returning")
ENGAGEMENT_LEVELS = ("any", "active")

EVENT_IMPRESSION = "impression"
EVENT_CLICK = "click"
EVENT_TYPES = (EVENT_IMPRESSION, EVENT_CLICK)

# Ações específicas logadas num clique — usadas pra medir objetivos como
# "abertura do WhatsApp/Instagram/site" (ver "Objetivo da campanha" no plano).
OBJECTIVE_ACTIONS = ("whatsapp", "instagram", "website", "map", "profile")


def default_targeting() -> dict:
    """Alvo de audiência: bloco único em JSON (mesmo idioma de `formats`),
    pra não exigir migração a cada novo eixo de segmentação. Todos os
    defaults abaixo reproduzem o comportamento de hoje (só bairro/cidade).
    """
    return {
        "citywide": False,
        "neighborhoods": [],
        "include_nearby": False,
        "radius_km": None,
        "center_lat": None,
        "center_lng": None,
        "audience": "all",
        "categories": [],
        "group_ids": [],
        "user_recency": "all",
        "engagement": "any",
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
    max_neighborhoods: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Agrupamento na tela de anúncios (ex.: "local_business", "event",
    # "enterprise") — puramente de apresentação, não afeta preço/entrega.
    category: Mapped[str | None] = mapped_column(String(30), nullable=True)
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
    status: Mapped[str] = mapped_column(
        String(20), default=STATUS_PENDING_PAYMENT, nullable=False
    )

    advertiser_name: Mapped[str] = mapped_column(String(120), nullable=False)
    advertiser_email: Mapped[str] = mapped_column(String(255), nullable=False)
    advertiser_phone: Mapped[str] = mapped_column(String(30), default="")

    # Link de acesso do anunciante ao próprio painel (`/anunciar/painel/{token}`,
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
    objective: Mapped[str] = mapped_column(
        String(30), default=DEFAULT_OBJECTIVE, nullable=False
    )
    priority: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    rotation_weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    daily_impression_cap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    per_user_impression_cap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pacing: Mapped[str] = mapped_column(String(10), default=PACING_ASAP, nullable=False)
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

    payment_provider: Mapped[str | None] = mapped_column(String(30), nullable=True)
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

    # Propriedades de conveniência: leem/gravam dentro de `targeting`, para
    # não espalhar `campaign.targeting["neighborhoods"]` pelo código todo —
    # o filtro de elegibilidade (`daos/ad.py`) e a precificação continuam
    # lendo `campaign.neighborhoods`/`campaign.citywide` como antes.
    @property
    def neighborhoods(self) -> list[str]:
        return self.targeting.get("neighborhoods", [])

    @property
    def citywide(self) -> bool:
        return bool(self.targeting.get("citywide", False))


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
    format: Mapped[str | None] = mapped_column(String(20), nullable=True)

    title: Mapped[str] = mapped_column(String(120), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cta_label: Mapped[str | None] = mapped_column(String(60), nullable=True)
    target_url: Mapped[str] = mapped_column(String(500), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

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
    event_type: Mapped[str] = mapped_column(String(12), nullable=False)
    format: Mapped[str] = mapped_column(String(20), nullable=False)
    neighborhood: Mapped[str | None] = mapped_column(String(120), nullable=True)
    viewer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    objective_action: Mapped[str | None] = mapped_column(String(20), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
