from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def create_tables():
    from app.models import (  # noqa: F401
        comment,
        group,
        message,
        notification,
        post,
        review,
        user,
    )
    Base.metadata.create_all(bind=engine)
    _ensure_columns()


def _ensure_columns():
    """Migrações leves para colunas adicionadas a tabelas já existentes (SQLite)."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "notifications" in tables:
        columns = {c["name"] for c in inspector.get_columns("notifications")}
        if "target_text" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE notifications ADD COLUMN target_text VARCHAR(300)"))

    if "users" in tables:
        columns = {c["name"] for c in inspector.get_columns("users")}
        with engine.begin() as conn:
            if "totp_secret" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN totp_secret VARCHAR(64)"))
            if "totp_enabled" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT 0 NOT NULL"))
            if "is_moderator" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_moderator BOOLEAN DEFAULT 0 NOT NULL"))
            if "comments_count" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN comments_count INTEGER DEFAULT 0 NOT NULL"))
            if "help_count" in columns:
                conn.execute(text("ALTER TABLE users DROP COLUMN help_count"))

    if "messages" in tables:
        columns = {c["name"] for c in inspector.get_columns("messages")}
        if "shared_post_id" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE messages ADD COLUMN shared_post_id INTEGER REFERENCES posts(id)"))

    if "posts" in tables:
        columns = {c["name"] for c in inspector.get_columns("posts")}
        with engine.begin() as conn:
            if "poll_multiple" not in columns:
                conn.execute(text("ALTER TABLE posts ADD COLUMN poll_multiple BOOLEAN"))
            if "poll_closes_at" not in columns:
                conn.execute(text("ALTER TABLE posts ADD COLUMN poll_closes_at DATETIME"))
