from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.geo_cache import GeoCacheEntry, GeoCacheKind


def get(db: Session, kind: GeoCacheKind, cache_key: str) -> GeoCacheEntry | None:
    row = (
        db.query(GeoCacheEntry)
        .filter(GeoCacheEntry.kind == kind, GeoCacheEntry.cache_key == cache_key)
        .first()
    )
    if row:
        expires_at = row.expires_at
        if expires_at.tzinfo is None:  # SQLite não guarda tz — mesmo caso de models/mute.py::is_active
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            return None  # expirado = miss; upsert() sobrescreve na próxima escrita
    return row


def upsert(
    db: Session,
    kind: GeoCacheKind,
    cache_key: str,
    payload: dict | list,
    provider: str,
    ttl_seconds: int,
) -> GeoCacheEntry:
    row = (
        db.query(GeoCacheEntry)
        .filter(GeoCacheEntry.kind == kind, GeoCacheEntry.cache_key == cache_key)
        .first()
    )
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
    if row:
        row.payload, row.provider, row.expires_at = payload, provider, expires_at
    else:
        row = GeoCacheEntry(
            kind=kind, cache_key=cache_key, payload=payload, provider=provider, expires_at=expires_at
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return row
