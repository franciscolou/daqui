from pathlib import Path

from pydantic_settings import BaseSettings

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Loop de expiração de campanhas (ver main.py::_expire_campaigns_loop)
EXPIRE_CAMPAIGNS_INTERVAL_SECONDS = 30

# Desconto de pacote sobre o preço que a engine dinâmica cobraria pelos
# mesmos parâmetros (ver seed_plans.py::_plan_price) — mesma taxa do combo
# post+mapa (POST_MAP_BUNDLE_DISCOUNT acima), reaproveitada aqui só por
# consistência de "número redondo já usado no sistema", não por acoplamento
# entre os dois. Recompensa quem compra o pacote pronto em vez de configurar
# do zero, na MESMA proporção pra todo plano — existe pra manter plano fixo e
# configurador dinâmico sempre consistentes entre si.
PLAN_DISCOUNT = 0.85

# Precificação de anúncios (ver services/ad_pricing.py::quote/format_base)
FORMAT_DAILY_RATE_CENTS = {
    "post": 350,  # card no feed — a superfície de maior atenção
    "map": 350,  # pin no mapa do bairro — o diferencial do Daqui
    "notification": 300,
    "search_poster": 300,
    "conversation": 250,  # aba Mensagens — a superfície menos acessada
}

# Combo "post + mapa": os dois juntos saem 15% mais baratos que a soma dos
# preços individuais (350 + 350 = 700 → 595/dia). O desconto incide SÓ sobre
# a parcela desses dois formatos — os demais escolhidos na mesma campanha
# continuam custando o preço cheio (ver `ad_pricing.py::format_base`).
POST_MAP_BUNDLE_DISCOUNT = 0.15

OBJECTIVE_MULTIPLIERS = {
    "reach": 0.9,
    "clicks": 1.0,
    "profile_visits": 1.05,
    "map_opens": 1.05,
    "instagram_opens": 1.1,
    "whatsapp_opens": 1.15,
    "website_opens": 1.15,
}

PEAK_HOURS = set(range(18, 23))  # 18h-22h

NEIGHBORHOOD_GROWTH_RATE = 0.15
CITY_GROWTH_RATE = 0.4

# CITYWIDE/CITIES/COUNTRY costumavam ser multiplicadores soltos (3.0/-/12.0)
# escolhidos à parte da fórmula de bairro. Isso subprecificava escopo largo:
# CITYWIDE=3.0 equivalia, na prática, a comprar só ~15 bairros um a um
# (1 + 0.15*14) — um desconto de volume que ninguém decidiu de propósito,
# porque nenhuma cidade coberta pelo Daqui tem só ~15 bairros ativos.
# Agora CITYWIDE ancora numa estimativa de quantos bairros ativos uma cidade
# coberta costuma ter, e CITIES/COUNTRY continuam crescendo a partir desse
# mesmo patamar — uma única curva, em vez de 3 números desconexos.
#
# São estimativas, não medições: o ads-backend não enxerga a contagem real
# de bairros ativos por cidade (só recebe o nome via query param — ver
# arquitetura em CLAUDE.md). Recalibrar com dado real assim que houver
# telemetria de bairros ativos por cidade coberta.
CITYWIDE_EQUIVALENT_NEIGHBORHOODS = 25
COUNTRY_EQUIVALENT_CITIES = 20

# `special_dates`, quando preenchido, cobra um prêmio que escala com o quão
# concentrada fica a entrega (ver `ad_pricing.py::seasonality_multiplier`).
SPECIAL_DATES_MAX_PREMIUM = 0.3
SPECIAL_DATES_MIN_PREMIUM = 0.05

# Desconto por duração — interpolado linearmente entre estes pontos (ver
# `ad_pricing.py::duration_discount`), sem os degraus fixos de antes.
DURATION_DISCOUNT_ANCHORS = [
    (1, 1.0),
    (30, 0.95),
    (90, 0.85),
    (180, 0.78),
    (365, 0.7),
    (720, 0.6),
]

# Geocoding (ver core/geocoding/{here,nominatim}.py — mesmos valores do backend principal)
HERE_TIMEOUT_SECONDS = 6.0
NOMINATIM_TIMEOUT_SECONDS = 8.0
# Overpass costuma ser mais lento; damos uma folga maior no timeout.
OVERPASS_TIMEOUT_SECONDS = 25.0


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./ads.db"
    SECRET_KEY: str = "troque-por-uma-chave-secreta-forte-em-producao"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 dias
    ENVIRONMENT: str = "development"

    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    # Sem default de propósito (mesmo espírito do FRONTEND_URL no backend
    # principal): apontar silenciosamente pra localhost em produção manda o
    # anunciante de volta pro lugar errado depois de pagar. Ver .env/.env.example.
    STRIPE_SUCCESS_URL: str
    STRIPE_CANCEL_URL: str

    ADS_ADMIN_EMAIL: str = "ads@daqui.com"
    ADS_ADMIN_PASSWORD: str = "senha123"

    # E-mail transacional (redefinição de senha) — mesmo provedor do backend
    # principal (Resend), ver app/core/email.py.
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Daqui Ads <onboarding@resend.dev>"
    # URL do próprio painel estático (ads-admin/index.html) — usada para montar
    # o link de redefinição de senha, já que (ao contrário do moderador) não
    # existe outro app pra abrir essa tela. Sem default pelo mesmo motivo acima.
    ADS_ADMIN_URL: str

    # HERE Geocoding & Search API (opcional, mesma conta/cota do backend
    # principal — ver backend/app/core/config.py). Sem chave, o autocomplete
    # de local do anúncio roda só no Nominatim (grátis), sem interpolação de
    # número exato.
    HERE_API_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
