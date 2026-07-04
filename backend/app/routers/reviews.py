from fastapi import APIRouter

from app.controllers import review
from app.schemas.review import ReviewAdminOut, ReviewOut, ReviewStats

# App Daqui (usuário): enviar e ver a própria avaliação.
router = APIRouter(prefix="/reviews", tags=["reviews"])
router.post("/", response_model=ReviewOut, status_code=201)(review.submit_review)
router.get("/me", response_model=ReviewOut | None)(review.get_my_review)

# App de moderação: rotas restritas a moderadores. Avaliação é a opinião do
# usuário — a moderação só pode excluir (abuso/spam), não aprovar/rejeitar.
admin_router = APIRouter(prefix="/admin/reviews", tags=["moderation"])
admin_router.get("/stats", response_model=ReviewStats)(review.reviews_stats)
admin_router.get("", response_model=list[ReviewAdminOut])(review.list_reviews)
admin_router.delete("/{review_id}", status_code=204)(review.delete_review)
