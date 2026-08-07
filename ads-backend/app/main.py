import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import UPLOAD_DIR
from app.daos import ad as ad_dao
from app.database import SessionLocal, create_tables
from app.routers import ads, audit_log, auth, geo, staff

logger = logging.getLogger(__name__)

EXPIRE_CAMPAIGNS_INTERVAL_SECONDS = 30


async def _expire_campaigns_loop() -> None:
    """Único "job" de expiração do serviço: roda em processo, sem depender
    de infra externa (scheduler/cron/lambda) — troca por EventBridge+Lambda
    (ou equivalente) chamando o mesmo `ad_dao.expire_due_campaigns` quando
    for pra produção."""
    while True:
        db = SessionLocal()
        try:
            ad_dao.expire_due_campaigns(db)
        except Exception:
            logger.exception("Falha ao expirar campanhas vencidas")
        finally:
            db.close()
        await asyncio.sleep(EXPIRE_CAMPAIGNS_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    task = asyncio.create_task(_expire_campaigns_loop())
    yield
    task.cancel()


app = FastAPI(
    title="Daqui Ads API",
    description="Backend independente de anunciantes/anúncios do Daqui",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção: especificar domínios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(ads.router, prefix="/api/v1")
app.include_router(ads.admin_router, prefix="/api/v1")
app.include_router(staff.admin_router, prefix="/api/v1")
app.include_router(geo.admin_router, prefix="/api/v1")
app.include_router(audit_log.admin_router, prefix="/api/v1")

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/")
def root():
    return {"service": "Daqui Ads API", "version": "1.0.0", "status": "online"}


@app.get("/health")
def health():
    return {"status": "ok"}
