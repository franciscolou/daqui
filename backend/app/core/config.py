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
# Sem infra de pub/sub: cada conexão do /ws faz polling periódico no banco.
# Suficiente pra escala do app (SQLite, um processo uvicorn); notificação nova
# e suspensão de conta interrompem a espera na hora via realtime_registry.wake()
# em vez de esperar o próximo tick.
WS_POLL_INTERVAL_SECONDS = 2.0

# Geocoding (ver core/geocoding/{here,nominatim}.py)
HERE_TIMEOUT_SECONDS = 6.0
NOMINATIM_TIMEOUT_SECONDS = 8.0
# Overpass costuma ser mais lento; damos uma folga maior no timeout.
OVERPASS_TIMEOUT_SECONDS = 25.0


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./daqui.db"
    SECRET_KEY: str = "troque-por-uma-chave-secreta-forte-em-producao"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 dias
    ENVIRONMENT: str = "development"

    # E-mail transacional (código de verificação, link de redefinição de senha).
    # Em development, core/email.py não chama o Resend: só loga no console.
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Daqui <onboarding@resend.dev>"
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
    # interpolação de número exato no autocomplete (/geo/search). Cadastro:
    # developer.here.com. O tamanho do free tier específico pra Geocoding &
    # Search não está confirmado por documentação — checar na conta antes de
    # depender em produção.
    HERE_API_KEY: str = ""

    # Client ID OAuth do Google Cloud Console (tipo "Aplicativo da Web").
    # Único audience aceito em /auth/google — inclusive nos ID tokens emitidos
    # nativamente (iOS/Android configuram GoogleSignin com este mesmo valor
    # como webClientId de propósito, pra sair só uma audience pro backend
    # validar). Vazio = /auth/google responde 501 (ver core/google_oauth.py).
    GOOGLE_WEB_CLIENT_ID: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
