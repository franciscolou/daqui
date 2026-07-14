from sqlalchemy.orm import Session

from app.models.settings import AdSettings

_SINGLETON_ID = 1


def get(db: Session) -> AdSettings:
    settings = db.get(AdSettings, _SINGLETON_ID)
    if not settings:
        settings = AdSettings(id=_SINGLETON_ID, price_multiplier=1.0)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def update(db: Session, settings: AdSettings, **fields) -> AdSettings:
    for field, value in fields.items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings
