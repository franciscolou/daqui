from fastapi import APIRouter

from app.controllers import comment, post, user
from app.schemas.comment import CommentOut
from app.schemas.post import PostOut
from app.schemas.user import (
    NeighborhoodStats,
    UserAdminOut,
    UsernameAvailability,
    UserPublic,
)

router = APIRouter(prefix="/users", tags=["users"])

router.get(  "/neighbors",          response_model=list[UserPublic])(user.list_neighbors)
router.get(  "/popular",            response_model=list[UserPublic])(user.list_popular)
router.get(  "/check-username",     response_model=UsernameAvailability)(user.check_username)
router.get(  "/neighborhood-stats", response_model=NeighborhoodStats)(user.neighborhood_stats)
router.patch("/me",                 response_model=UserPublic)(user.update_me)
router.post( "/me/avatar",          response_model=UserPublic)(user.update_avatar)
router.post( "/me/cover",           response_model=UserPublic)(user.update_cover)
router.get(  "/{user_id}",          response_model=UserPublic)(user.get_user)
router.get(  "/{user_id}/posts",    response_model=list[PostOut])(post.list_by_author)

# App de moderação: buscar usuários, inspecionar posts/comentários e suspender contas.
admin_router = APIRouter(prefix="/admin/users", tags=["moderation"])
admin_router.get("/search", response_model=list[UserAdminOut])(user.admin_search_users)
admin_router.get("/{user_id}/posts", response_model=list[PostOut])(post.admin_list_by_author)
admin_router.get("/{user_id}/comments", response_model=list[CommentOut])(comment.admin_list_by_author)
admin_router.post("/{user_id}/suspend", response_model=UserAdminOut)(user.admin_suspend_user)
admin_router.delete("/{user_id}/suspend", response_model=UserAdminOut)(user.admin_unsuspend_user)
