from fastapi import APIRouter

from app.controllers import post
from app.schemas.post import ImportantQuota, PostFeed, PostMediaItem, PostOut
from app.schemas.user import UserPublic

router = APIRouter(prefix="/posts", tags=["posts"])

router.get(
    "/feed",
    response_model=PostFeed,
)(post.get_feed)

router.get(
    "/important",
    response_model=PostOut | None,
)(post.get_top_important)

# Estático antes de "/{post_id}" — cota de posts importantes do mês (ver
# services/post.py::get_important_quota), consultada pelo publish.tsx antes de
# publicar pra desabilitar o toggle sem depender de tentar e falhar.
router.get(
    "/important-quota",
    response_model=ImportantQuota,
)(post.get_important_quota)

router.get(
    "/map",
    response_model=list[PostOut],
)(post.get_map_posts)

# Estático antes de "/{post_id}", senão o FastAPI captura "media" como id.
router.post(
    "/media",
    response_model=PostMediaItem,
    status_code=201,
)(post.upload_media)

router.post(
    "/",
    response_model=PostOut,
    status_code=201,
)(post.create_post)

# Estático antes de "/{post_id}" — resolve a URL pública
# `/post/{username}/status/{public_id}` do app pelo identificador opaco
# (ver models/post.py::public_id), sem expor o id sequencial.
router.get(
    "/by-public-id/{public_id}",
    response_model=PostOut,
)(post.get_post_by_public_id)

router.get(
    "/{post_id}",
    response_model=PostOut,
)(post.get_post)

router.patch(
    "/{post_id}",
    response_model=PostOut,
)(post.update_post)

router.post(
    "/{post_id}/vote",
    response_model=PostOut,
)(post.vote_poll)

router.delete(
    "/{post_id}/vote",
    response_model=PostOut,
)(post.unvote_poll)

router.post(
    "/{post_id}/like",
    response_model=PostOut,
)(post.toggle_like)

router.get(
    "/{post_id}/likes",
    response_model=list[UserPublic],
)(post.list_likers)

router.post(
    "/{post_id}/repost",
    response_model=PostOut,
)(post.toggle_repost)

router.delete(
    "/{post_id}",
    status_code=204,
)(post.delete_post)

# App de moderação: excluir qualquer post (independente do autor).
admin_router = APIRouter(prefix="/admin/posts", tags=["moderation"])
admin_router.delete("/{post_id}", status_code=204)(post.admin_delete_post)
