from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def create_tables():
    from app.models import ad, admin, audit_log, geo_cache, settings  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    _run_data_migrations()


def _run_data_migrations():
    """Migrações de DADOS (conteúdo de linhas, não schema). Diferente de
    `_ensure_columns`, aqui a existência de uma coluna não serve de guarda —
    rodar de novo estragaria escolhas legítimas do usuário —, então cada
    migração é registrada por chave em `ads_data_migrations` e roda uma vez só.
    """
    from sqlalchemy import text

    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS ads_data_migrations ("
                "key VARCHAR(80) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
            )
        )
        applied = {
            row[0] for row in conn.execute(text("SELECT key FROM ads_data_migrations"))
        }

        # "post" deixou de significar "feed + pin no mapa" e virou só o card no
        # feed, com o pin no formato "map" (ver models/ad.py::AdFormat). Quem
        # contratou antes da separação comprou os dois lugares, então ganha o
        # "map" — a partir daqui a escolha passa a ser sempre explícita, e por
        # isso esta migração NÃO pode rodar de novo (post sozinho hoje é uma
        # opção válida, não um dado a corrigir).
        if "split_post_map_formats" not in applied:
            for table in ("ad_campaigns", "ad_plans"):
                conn.execute(
                    text(
                        f"UPDATE {table} SET formats = json_insert(formats, '$[#]', 'map') "  # noqa: S608
                        "WHERE EXISTS (SELECT 1 FROM json_each(formats) WHERE value = 'post') "
                        "AND NOT EXISTS (SELECT 1 FROM json_each(formats) WHERE value = 'map')"
                    )
                )
            conn.execute(
                text("INSERT INTO ads_data_migrations (key) VALUES ('split_post_map_formats')")
            )


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
            if "role" not in columns:
                conn.execute(
                    text("ALTER TABLE ad_admins ADD COLUMN role VARCHAR(20) DEFAULT 'moderador' NOT NULL")
                )
                # Bootstrap: a conta seed conhecida vira owner (única promoção automática).
                conn.execute(
                    text("UPDATE ad_admins SET role = 'owner' WHERE email = :email"),
                    {"email": settings.ADS_ADMIN_EMAIL},
                )
            if "is_suspended" not in columns:
                conn.execute(text("ALTER TABLE ad_admins ADD COLUMN is_suspended BOOLEAN DEFAULT 0 NOT NULL"))
            if "avatar_url" not in columns:
                conn.execute(text("ALTER TABLE ad_admins ADD COLUMN avatar_url VARCHAR(500)"))
            if "username" not in columns:
                # Contas anteriores à coluna: handle derivado do e-mail, com
                # sufixo numérico se colidir (a coluna é única).
                from app.core.username import suggest_from_email

                conn.execute(text("ALTER TABLE ad_admins ADD COLUMN username VARCHAR(30)"))
                taken: set[str] = set()
                rows = list(conn.execute(text("SELECT id, email FROM ad_admins")))
                for admin_id, email in rows:
                    handle = suggest_from_email(email)
                    candidate, n = handle, 2
                    while candidate in taken:
                        candidate, n = f"{handle[:16]}{n}", n + 1
                    taken.add(candidate)
                    conn.execute(
                        text("UPDATE ad_admins SET username = :u WHERE id = :id"),
                        {"u": candidate, "id": admin_id},
                    )
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_ad_admins_username "
                        "ON ad_admins (username)"
                    )
                )
