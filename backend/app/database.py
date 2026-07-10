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
        audit_log,
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
        with engine.begin() as conn:
            if "target_text" not in columns:
                conn.execute(text("ALTER TABLE notifications ADD COLUMN target_text VARCHAR(300)"))
            if "snapshot" not in columns:
                conn.execute(text("ALTER TABLE notifications ADD COLUMN snapshot JSON"))

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
            if "is_suspended" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_suspended BOOLEAN DEFAULT 0 NOT NULL"))
            if "suspended_until" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN suspended_until DATETIME"))
            if "suspension_reason" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN suspension_reason TEXT DEFAULT ''"))

    if "messages" in tables:
        columns = {c["name"] for c in inspector.get_columns("messages")}
        with engine.begin() as conn:
            if "shared_post_id" not in columns:
                conn.execute(text("ALTER TABLE messages ADD COLUMN shared_post_id INTEGER REFERENCES posts(id)"))
            if "shared_comment_id" not in columns:
                conn.execute(text("ALTER TABLE messages ADD COLUMN shared_comment_id INTEGER REFERENCES comments(id)"))
            if "reply_to_id" not in columns:
                conn.execute(text("ALTER TABLE messages ADD COLUMN reply_to_id INTEGER REFERENCES messages(id)"))

    if "comments" in tables:
        columns = {c["name"] for c in inspector.get_columns("comments")}
        with engine.begin() as conn:
            if "parent_id" not in columns:
                conn.execute(text("ALTER TABLE comments ADD COLUMN parent_id INTEGER REFERENCES comments(id)"))
            if "likes_count" not in columns:
                conn.execute(text("ALTER TABLE comments ADD COLUMN likes_count INTEGER DEFAULT 0 NOT NULL"))

    if "group_messages" in tables:
        columns = {c["name"] for c in inspector.get_columns("group_messages")}
        if "reply_to_id" not in columns:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE group_messages ADD COLUMN reply_to_id INTEGER REFERENCES group_messages(id)")
                )

    if "posts" in tables:
        columns = {c["name"] for c in inspector.get_columns("posts")}
        with engine.begin() as conn:
            if "poll_multiple" not in columns:
                conn.execute(text("ALTER TABLE posts ADD COLUMN poll_multiple BOOLEAN"))
            if "poll_closes_at" not in columns:
                conn.execute(text("ALTER TABLE posts ADD COLUMN poll_closes_at DATETIME"))
            if "image_urls" not in columns:
                conn.execute(text("ALTER TABLE posts ADD COLUMN image_urls JSON"))
                # Backfill: migra a foto única legada (image_url) para a lista.
                conn.execute(
                    text(
                        "UPDATE posts SET image_urls = json_array(image_url) "
                        "WHERE image_url IS NOT NULL"
                    )
                )
                conn.execute(
                    text("UPDATE posts SET image_urls = '[]' WHERE image_urls IS NULL")
                )

    if "reviews" in tables:
        columns = {c["name"] for c in inspector.get_columns("reviews")}
        # Avaliação não passa mais por aprovação/rejeição da moderação.
        if "status" in columns:
            with engine.begin() as conn:
                conn.execute(text("DROP INDEX IF EXISTS ix_reviews_status"))
                conn.execute(text("ALTER TABLE reviews DROP COLUMN status"))
