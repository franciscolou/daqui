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
    STRIPE_SUCCESS_URL: str = "http://localhost:8081/anunciar/checkout/sucesso"
    STRIPE_CANCEL_URL: str = "http://localhost:8081/anunciar/checkout"

    ADS_ADMIN_EMAIL: str = "ads@daqui.com"
    ADS_ADMIN_PASSWORD: str = "senha123"

    # E-mail transacional (redefinição de senha) — mesmo provedor do backend
    # principal (Resend), ver app/core/email.py.
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Daqui Ads <onboarding@resend.dev>"
    # URL do próprio painel estático (ads-admin/index.html) — usada para montar
    # o link de redefinição de senha, já que (ao contrário do moderador) não
    # existe outro app pra abrir essa tela.
    ADS_ADMIN_URL: str = "http://localhost:8091"

    class Config:
        env_file = ".env"


settings = Settings()
