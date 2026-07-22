from fastapi import APIRouter

from app.controllers import push

router = APIRouter(prefix="/push", tags=["push"])

router.post("/register", status_code=204)(push.register_push_token)
router.delete("/register", status_code=204)(push.unregister_push_token)
