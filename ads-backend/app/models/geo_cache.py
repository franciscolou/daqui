from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import JSON, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GeoCacheKind(StrEnum):
    """As 3 rotas de geo.py que consultam provedor externo — cada uma com sua
    própria forma de chave (ver daos/geo_cache.py e services/geo.py)."""

    FORWARD = "forward"   # geocode_within — endereço já fechado
    SEARCH = "search"     # search_within — sugestões de autocomplete
    REVERSE = "reverse"   # resolve_neighborhood — ponto -> bairro


class GeoCacheEntry(Base):
    __tablename__ = "geo_cache"
    __table_args__ = (
        UniqueConstraint("kind", "cache_key", name="uq_geo_cache_kind_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    kind: Mapped[GeoCacheKind] = mapped_column(String(10), nullable=False)
    cache_key: Mapped[str] = mapped_column(String(500), nullable=False)
    # Metadado/observabilidade (qual provedor respondeu) — não faz parte da
    # chave: uma vez resolvido pelo HERE, aquele texto exato nunca mais paga
    # de novo, mesmo que uma busca futura não geraria escalada por si só.
    provider: Mapped[str] = mapped_column(String(20), nullable=False, default="nominatim")
    payload: Mapped[dict | list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
