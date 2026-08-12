from pathlib import Path

from pydantic_settings import BaseSettings

# Diretório onde ficam os uploads (ex.: fotos de perfil). Servido em /uploads.
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Posts (ver services/post.py)
# Post importante notifica todo o bairro (e redondezas) na hora — limite pra
# não virar spam de notificação (ver contagem em create_post/get_important_quota).
MAX_IMPORTANT_POSTS_PER_MONTH = 2
# A partir do 4º curtidor (total > este limite), as notificações de curtida
# de um mesmo post mesclam numa só, estilo Instagram (menos poluição na aba
# de novidades). Abaixo disso cada curtida ainda gera sua própria notificação.
LIKE_MERGE_THRESHOLD = 3
MAX_MEDIA_ITEMS = 10

# Feed (ver services/post.py::get_feed)
# Meia-vida da recência: quanto tempo até o "peso" de um post cair pela
# metade — mantém posts novos em vantagem forte sobre antigos mesmo com
# popularidade/afinidade alta.
FEED_RECENCY_HALF_LIFE_HOURS = 30.0
# Engajamento (curtidas/comentários/compartilhamentos) que compõe o boost de
# popularidade — comentário e compartilhamento pesam mais que curtida por
# exigirem mais esforço/intenção de quem interagiu.
FEED_ENGAGEMENT_WEIGHT_LIKE = 1.0
FEED_ENGAGEMENT_WEIGHT_COMMENT = 2.0
FEED_ENGAGEMENT_WEIGHT_SHARE = 2.0
# Escala do boost log1p(engajamento) aplicado ao score final.
FEED_POPULARITY_BOOST_WEIGHT = 0.35
# Personalização: quanto o histórico do próprio usuário (curtidas/comentários/
# reposts dados, DMs, grupos em comum) empurra um post pra cima. Janela de
# lookback pra afinidade não acumular pra sempre e ficar refletindo interesse
# recente do usuário.
FEED_PERSONALIZATION_LOOKBACK_DAYS = 90
FEED_AUTHOR_AFFINITY_WEIGHT_LIKE = 1.0
FEED_AUTHOR_AFFINITY_WEIGHT_COMMENT = 2.0
FEED_AUTHOR_AFFINITY_WEIGHT_SHARE = 2.0
# Bônus fixo de afinidade por autor quando o usuário já trocou DM com ele ou
# está no mesmo grupo — proxy de laço social, já que o app não tem "seguir".
FEED_AUTHOR_AFFINITY_DM_BONUS = 3.0
FEED_AUTHOR_AFFINITY_GROUP_BONUS = 1.5
FEED_AUTHOR_AFFINITY_BOOST_WEIGHT = 0.25
FEED_CATEGORY_AFFINITY_BOOST_WEIGHT = 0.15
# Teto do boost de personalização combinado (afinidade por autor + por
# categoria) — garante que recência e popularidade continuem sendo os
# fatores dominantes do score, não a personalização.
FEED_PERSONALIZATION_MAX_BOOST = 1.5

# Vendas (ver services/post.py::create_post, models/post.py::Post.product_name)
SALE_MIN_PHOTOS = 1
SALE_PRODUCT_NAME_MAX_LENGTH = 120

# Denúncias e chamados de suporte (ver schemas/{attachment,report,support_ticket}.py)
TICKET_MAX_ATTACHMENTS = 3
TICKET_MAX_SUBJECT_LENGTH = 120  # chamado de suporte
TICKET_MAX_MESSAGE_LENGTH = 2000  # chamado de suporte
TICKET_MAX_RESPONSE_LENGTH = 2000  # resposta do moderador ao chamado
REPORT_MAX_COMMENT_LENGTH = 3000  # denúncias

# Realtime (ver core/typing_registry.py, routers/ws.py)
# Uma entrada de "digitando" expira sozinha após TYPING_TTL_SECONDS sem novo
# aviso — não precisa de limpeza explícita, só filtramos pela idade na leitura.
TYPING_TTL_SECONDS = 4.0
# Todo evento relevante (mensagem, mensagem de grupo, digitando, notificação,
# suspensão de conta) chama `realtime_registry.wake()` e interrompe a espera
# na hora — o polling deixou de ser o mecanismo principal de entrega, então
# este intervalo só serve de heartbeat de segurança (cobre bug de plumbing no
# wake() e o caso raro de conexão que perdeu o wake por timing). Sem infra de
# pub/sub entre réplicas (ver CLAUDE.md, "Estado em memória de processo
# único") — `wake()` só alcança conexões na mesma réplica.
WS_POLL_INTERVAL_SECONDS = 30.0

# Analytics (ver models/analytics.py, services/analytics.py)
# Lote de eventos que o cliente reporta de uma vez em POST /analytics/events.
ANALYTICS_MAX_EVENTS_PER_BATCH = 50
# Quantos itens aparecem em cada ranking (telas, cliques, buscas) no overview
# por padrão — o moderator pode pedir mais via `limit`, até ANALYTICS_MAX_TOP_N.
ANALYTICS_TOP_N = 10
ANALYTICS_MAX_TOP_N = 20
ANALYTICS_MAX_QUERY_LENGTH = 200
ANALYTICS_MAX_LABEL_LENGTH = 80
# Período do overview quando o moderator não passa date_from/date_to.
ANALYTICS_DEFAULT_RANGE_DAYS = 30

# Geocoding (ver core/geocoding/{here,nominatim}.py)
HERE_TIMEOUT_SECONDS = 6.0
NOMINATIM_TIMEOUT_SECONDS = 8.0
# Overpass costuma ser mais lento; damos uma folga maior no timeout.
OVERPASS_TIMEOUT_SECONDS = 25.0
# Respiro antes de tentar de novo quando o Overpass responde 429 (rate limit)
# — ver core/geocoding/nominatim.py::_query_overpass.
OVERPASS_RATE_LIMIT_BACKOFF_SECONDS = 1.5

# Anúncios (ver models/ad.py, services/ad.py, services/ad_pricing.py)
# Loop de expiração de campanhas (ver main.py::_expire_campaigns_loop)
EXPIRE_CAMPAIGNS_INTERVAL_SECONDS = 30

# Máximo de parcelas oferecido no checkout (Asaas, ver core/payments.py) pra
# quem paga no cartão — o anunciante escolhe à vista ou em quantas parcelas
# quiser até esse teto, na própria tela do Asaas.
ADS_CHECKOUT_MAX_INSTALLMENTS = 12

# Desconto de pacote sobre o preço que a engine dinâmica cobraria pelos
# mesmos parâmetros (ver seed_ads_plans.py::_plan_price) — mesma taxa do combo
# post+mapa (POST_MAP_BUNDLE_DISCOUNT abaixo), reaproveitada aqui só por
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
# São estimativas, não medições: a engine não enxerga a contagem real de
# bairros ativos por cidade (só recebe o nome via query param). Recalibrar
# com dado real assim que houver telemetria de bairros ativos por cidade
# coberta.
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


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./daqui.db"
    SECRET_KEY: str = "troque-por-uma-chave-secreta-forte-em-producao"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 dias
    ENVIRONMENT: str = "development"

    # E-mail transacional (código de verificação, link de redefinição de senha).
    # Em development, core/email.py não chama o Resend: só loga no console.
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Daqui <team.daqui@gmail.com>"
    # Usado para montar o link de redefinição de senha enviado por e-mail.
    # Sem default de propósito: um FRONTEND_URL errado silenciosamente aponta
    # o link do e-mail pro ambiente errado, então preferimos falhar ao subir
    # (ver .env/.env.example) a mandar e-mail com link quebrado em produção.
    FRONTEND_URL: str
    # URL do painel de moderação estático (moderator/index.html) — usada só
    # pro link de convite de conta de staff (services/staff.py). Diferente da
    # redefinição de senha comum (que abre o app, FRONTEND_URL acima): quem
    # aceita um convite ainda não tem conta no app pra fazer login nela, então
    # o fluxo inteiro (escolher usuário/senha) roda no próprio painel — mesmo
    # motivo do ADS_ADMIN_URL no ads-backend. Sem default pelo mesmo espírito.
    MODERATOR_URL: str

    # Push notification (Expo Push Service). Opcional: só necessário se o
    # projeto Expo tiver "enhanced push security" habilitado.
    EXPO_ACCESS_TOKEN: str = ""

    # HERE Geocoding & Search API (opcional). Sem chave, core/geocoding/router.py
    # nunca escalona pro HERE — roda 100% Nominatim (grátis), só perdendo a
    # interpolação de número exato no autocomplete (/geo/search) e a
    # resiliência extra do reverse geocode (/geo/resolve, quando o Nominatim
    # falha ou não resolve bairro nenhum). Cadastro: developer.here.com. O
    # tamanho do free tier específico pra Geocoding & Search não está
    # confirmado por documentação — checar na conta antes de depender em
    # produção.
    HERE_API_KEY: str = ""

    # Client ID OAuth do Google Cloud Console (tipo "Aplicativo da Web").
    # Único audience aceito em /auth/google — inclusive nos ID tokens emitidos
    # nativamente (iOS/Android configuram GoogleSignin com este mesmo valor
    # como webClientId de propósito, pra sair só uma audience pro backend
    # validar). Vazio = /auth/google responde 501 (ver core/google_oauth.py).
    GOOGLE_WEB_CLIENT_ID: str = ""

    # Uploads de mídia — Cloudflare R2 (ver core/uploads.py). Opcional: sem
    # R2_BUCKET_NAME, uploads caem pro disco local (UPLOAD_DIR), servido em
    # /uploads — só serve pra dev local, não é confiável em produção (disco
    # efêmero na maioria dos PaaS, sem redundância numa VPS única).
    # R2_ACCOUNT_ID monta o endpoint (https://<id>.r2.cloudflarestorage.com);
    # R2_PUBLIC_URL é o domínio público do bucket (r2.dev ou domínio custom
    # conectado) usado pra montar a URL devolvida pro cliente.
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_PUBLIC_URL: str = ""

    # Anúncios — Asaas Checkout (ver core/payments.py; PIX e cartão à vista ou
    # parcelado, escolhidos pelo próprio anunciante na tela do Asaas — ver
    # ADS_CHECKOUT_MAX_INSTALLMENTS acima). Opcional: sem chave, tanto o
    # checkout quanto a submissão de conteúdo de proposta manual levantam erro
    # do Asaas em vez de devolver checkout_url — use
    # POST /admin/ads/campaigns/{id}/mark-paid pra testar sem pagar de verdade.
    # Cadastro/chaves: asaas.com (produção) ou sandbox.asaas.com (testes,
    # chave começa com "$aact_hmlg_"). O ambiente é decidido por
    # ENVIRONMENT acima (production -> api.asaas.com, resto -> sandbox).
    ASAAS_API_KEY: str = ""
    # Token que você mesmo escolhe ao configurar o Webhook no dashboard do
    # Asaas (Configurações -> Integrações -> Webhooks) — Asaas ecoa esse valor
    # de volta no header `asaas-access-token` de toda notificação, e é assim
    # que verificamos que a chamada veio de fato de lá (não é assinatura
    # criptográfica como no Stripe, é comparação direta — ver
    # core/payments.py::verify_webhook).
    ASAAS_WEBHOOK_TOKEN: str = ""
    # Sem default de propósito (mesmo espírito do FRONTEND_URL acima): apontar
    # silenciosamente pra localhost em produção manda o anunciante de volta
    # pro lugar errado depois de pagar. Ver .env/.env.example.
    ADS_CHECKOUT_SUCCESS_URL: str
    ADS_CHECKOUT_CANCEL_URL: str

    ADS_ADMIN_EMAIL: str = "ads@daqui.com"
    ADS_ADMIN_PASSWORD: str = "senha123"

    # URL do painel de anúncios estático (ads-admin/index.html) — usada pro
    # link de convite de conta de staff e de redefinição de senha de AdAdmin
    # (mesmo motivo do MODERATOR_URL acima: quem recebe o link ainda não tem
    # onde logar exceto o próprio painel). Sem default pelo mesmo espírito.
    ADS_ADMIN_URL: str

    class Config:
        env_file = ".env"


settings = Settings()
