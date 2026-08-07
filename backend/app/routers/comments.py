from fastapi import APIRouter

from app.controllers import comment
from app.schemas.attachment import AttachmentItem
from app.schemas.comment import CommentOut

router = APIRouter(tags=["comments"])

router.get(
    "/posts/{post_id}/comments",
    response_model=list[CommentOut],
)(comment.list_comments)

router.post(
    "/posts/{post_id}/comments",
    response_model=CommentOut,
    status_code=201,
)(comment.create_comment)

# Estático antes de "/comments/{comment_id}", senão o FastAPI captura "media" como id.
router.post(
    "/comments/media",
    response_model=AttachmentItem,
    status_code=201,
)(comment.upload_media)

router.get(
    "/comments/{comment_id}",
    response_model=CommentOut,
)(comment.get_comment)

router.get(
    "/comments/{comment_id}/replies",
    response_model=list[CommentOut],
)(comment.list_replies)

router.post(
    "/comments/{comment_id}/like",
    response_model=CommentOut,
)(comment.toggle_comment_like)

router.post(
    "/comments/{comment_id}/repost",
    response_model=CommentOut,
)(comment.toggle_comment_repost)

router.delete(
    "/comments/{comment_id}",
    status_code=204,
)(comment.delete_comment)

# App de moderação: excluir qualquer comentário (independente do autor).
admin_router = APIRouter(prefix="/admin/comments", tags=["moderation"])
admin_router.delete("/{comment_id}", status_code=204)(comment.admin_delete_comment)
