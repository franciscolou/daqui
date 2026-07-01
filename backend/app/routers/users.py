from fastapi import APIRouter

from app.controllers import post, user
from app.schemas.post import PostOut
from app.schemas.user import UserPublic

router = APIRouter(prefix="/users", tags=["users"])

router.get(  "/neighbors",       response_model=list[UserPublic])(user.list_neighbors)
router.get(  "/popular",         response_model=list[UserPublic])(user.list_popular)
router.patch("/me",              response_model=UserPublic)(user.update_me)
router.get(  "/{user_id}",       response_model=UserPublic)(user.get_user)
router.get(  "/{user_id}/posts", response_model=list[PostOut])(post.list_by_author)
