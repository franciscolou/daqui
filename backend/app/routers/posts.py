from fastapi import APIRouter

from app.controllers import post
from app.schemas.post import PostFeed, PostOut

router = APIRouter(prefix="/posts", tags=["posts"])

router.get(
    "/feed",
    response_model=PostFeed,
)(post.get_feed)

router.get(
    "/important",
    response_model=PostOut | None,
)(post.get_top_important)

router.get(
    "/map",
    response_model=list[PostOut],
)(post.get_map_posts)

router.post(
    "/",
    response_model=PostOut,
    status_code=201,
)(post.create_post)

router.get(
    "/{post_id}",
    response_model=PostOut,
)(post.get_post)

router.post(
    "/{post_id}/like",
    response_model=PostOut,
)(post.toggle_like)

router.delete(
    "/{post_id}",
    status_code=204,
)(post.delete_post)
