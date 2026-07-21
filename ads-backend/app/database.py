from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def create_tables():
    from app.models import ad, admin, settings  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_columns()


def _ensure_columns():
    """Migrações leves para colunas adicionadas a tabelas já existentes (SQLite)."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "ad_creatives" in tables:
        columns = {c["name"] for c in inspector.get_columns("ad_creatives")}
        if "video_url" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE ad_creatives ADD COLUMN video_url VARCHAR(500)"))
        if "linked_user_id" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE ad_creatives ADD COLUMN linked_user_id INTEGER")
                )

    if "ad_campaigns" in tables:
        columns = {c["name"] for c in inspector.get_columns("ad_campaigns")}
        if "access_token" not in columns:
            import secrets

            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE ad_campaigns ADD COLUMN access_token VARCHAR(64)")
                )
                ids = [row[0] for row in conn.execute(text("SELECT id FROM ad_campaigns"))]
                for campaign_id in ids:
                    conn.execute(
                        text(
                            "UPDATE ad_campaigns SET access_token = :token WHERE id = :id"
                        ),
                        {"token": secrets.token_urlsafe(24), "id": campaign_id},
                    )
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_ad_campaigns_access_token "
                        "ON ad_campaigns (access_token)"
                    )
                )
        if "advertiser_type" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE ad_campaigns ADD COLUMN advertiser_type "
                        "VARCHAR(20) DEFAULT 'individual' NOT NULL"
                    )
                )
        if "advertiser_document" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE ad_campaigns ADD COLUMN advertiser_document "
                        "VARCHAR(20) DEFAULT '' NOT NULL"
                    )
                )
        if "renewed_from_id" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE ad_campaigns ADD COLUMN renewed_from_id INTEGER")
                )
        if "root_campaign_id" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE ad_campaigns ADD COLUMN root_campaign_id INTEGER")
                )
                ids = [row[0] for row in conn.execute(text("SELECT id FROM ad_campaigns"))]
                for campaign_id in ids:
                    conn.execute(
                        text(
                            "UPDATE ad_campaigns SET root_campaign_id = :id WHERE id = :id"
                        ),
                        {"id": campaign_id},
                    )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_ad_campaigns_root_campaign_id "
                        "ON ad_campaigns (root_campaign_id)"
                    )
                )

    if "ad_admins" in tables:
        columns = {c["name"] for c in inspector.get_columns("ad_admins")}
        with engine.begin() as conn:
            if "totp_secret" not in columns:
                conn.execute(text("ALTER TABLE ad_admins ADD COLUMN totp_secret VARCHAR(64)"))
            if "totp_enabled" not in columns:
                conn.execute(text("ALTER TABLE ad_admins ADD COLUMN totp_enabled BOOLEAN DEFAULT 0 NOT NULL"))
