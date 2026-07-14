from sqlalchemy import Float, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AdSettings(Base):
    """Configurações gerais do painel de anúncios — linha única (id=1).
    Hoje só tem o multiplicador geral de preço; novas configurações viram
    novas colunas aqui, sem precisar de tabela chave-valor genérica.
    """

    __tablename__ = "ad_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Aplicado ao fim de todo cálculo de preço (planos e engine dinâmica) —
    # o gerente ajusta pra tornar os preços proporcionais ao desempenho do Daqui.
    price_multiplier: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
