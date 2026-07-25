from pathlib import Path

from pydantic_settings import BaseSettings

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


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

    class Config:
        env_file = ".env"


settings = Settings()
