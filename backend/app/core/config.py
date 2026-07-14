from pathlib import Path

from pydantic_settings import BaseSettings

# Diretório onde ficam os uploads (ex.: fotos de perfil). Servido em /uploads.
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


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
    FRONTEND_URL: str = "http://localhost:8081"

    class Config:
        env_file = ".env"


settings = Settings()
