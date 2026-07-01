from fastapi import APIRouter

from app.controllers import post, user
from app.schemas.post import PostOut
from app.schemas.user import NeighborhoodStats, UsernameAvailability, UserPublic

router = APIRouter(prefix="/users", tags=["users"])

router.get(  "/neighbors",          response_model=list[UserPublic])(user.list_neighbors)
router.get(  "/popular",            response_model=list[UserPublic])(user.list_popular)
router.get(  "/check-username",     response_model=UsernameAvailability)(user.check_username)
router.get(  "/neighborhood-stats", response_model=NeighborhoodStats)(user.neighborhood_stats)
router.patch("/me",                 response_model=UserPublic)(user.update_me)
router.post( "/me/avatar",          response_model=UserPublic)(user.update_avatar)
router.get(  "/{user_id}",          response_model=UserPublic)(user.get_user)
router.get(  "/{user_id}/posts",    response_model=list[PostOut])(post.list_by_author)
