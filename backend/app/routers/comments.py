from fastapi import APIRouter

from app.controllers import comment
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

router.delete(
    "/comments/{comment_id}",
    status_code=204,
)(comment.delete_comment)
