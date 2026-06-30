from fastapi import APIRouter

from app.controllers import user
from app.schemas.user import UserPublic

router = APIRouter(prefix="/users", tags=["users"])

router.get( "/neighbors",   response_model=list[UserPublic])(user.list_neighbors)
router.get( "/{user_id}",   response_model=UserPublic)(user.get_user)
router.patch("/me",         response_model=UserPublic)(user.update_me)
