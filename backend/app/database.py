from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def create_tables():
    from app.models import user, post, comment, message, notification  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _ensure_columns()


def _ensure_columns():
    """Migrações leves para colunas adicionadas a tabelas já existentes (SQLite)."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "notifications" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("notifications")}
    if "target_text" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE notifications ADD COLUMN target_text VARCHAR(300)"))
