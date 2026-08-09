from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_moderator, get_db
from app.models.user import User
from app.schemas.trash import TrashItemOut
from app.services import trash


def list_items(
    db: Session = Depends(get_db),
    _mod: User = Depends(get_current_moderator),
) -> list[TrashItemOut]:
    return trash.list_items(db)


def restore_item(
    item_type: str,
    item_id: int,
    db: Session = Depends(get_db),
    moderator: User = Depends(get_current_moderator),
) -> None:
    trash.restore(db, item_type, item_id, moderator)

