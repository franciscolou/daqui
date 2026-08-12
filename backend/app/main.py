import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import EXPIRE_CAMPAIGNS_INTERVAL_SECONDS, UPLOAD_DIR
from app.daos import ad as ad_dao
from app.database import SessionLocal
from app.routers import (
    ad_admin_auth,
    ad_audit_log,
    ad_geo,
    ad_staff,
    ads,
    analytics,
    audit_log,
    auth,
    comments,
    geo,
    groups,
    messages,
    notifications,
    posts,
    push,
    reports,
    reviews,
    search,
    staff,
    support_tickets,
    trash,
    users,
    ws,
)
from app.services import trash as trash_service

logger = logging.getLogger(__name__)


async def _expire_ad_campaigns_loop() -> None:
    """Único "job" de expiração de campanhas de anúncio: roda em processo,
    sem depender de infra externa (scheduler/cron/lambda) — troca por
    EventBridge+Lambda (ou equivalente) chamando o mesmo
    `ad_dao.expire_due_campaigns` quando for pra produção (ver "Estado em
    memória de processo único" no CLAUDE.md)."""
    while True:
        db = SessionLocal()
        try:
            ad_dao.expire_due_campaigns(db)
        except Exception:
            logger.exception("Falha ao expirar campanhas de anúncio vencidas")
        finally:
            db.close()
        await asyncio.sleep(EXPIRE_CAMPAIGNS_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema é responsabilidade do `alembic upgrade head` (rodado antes de
    # subir a API, ver dev.sh/deploy) — não mais criado/corrigido aqui no
    # boot, até por não ser seguro repetir em múltiplas réplicas.
    # Garante a retenção mesmo que ninguém abra a tela da lixeira após o prazo.
    with SessionLocal() as db:
        trash_service.purge_expired(db)

    task = asyncio.create_task(_expire_ad_campaigns_loop())
    yield
    task.cancel()


app = FastAPI(
    title="Daqui API",
    description="Backend da rede social de bairro Daqui",
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
app.include_router(posts.router, prefix="/api/v1")
app.include_router(posts.admin_router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(users.admin_router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(groups.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(reviews.admin_router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(reports.admin_router, prefix="/api/v1")
app.include_router(support_tickets.router, prefix="/api/v1")
app.include_router(support_tickets.admin_router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(push.router, prefix="/api/v1")
app.include_router(comments.router, prefix="/api/v1")
app.include_router(comments.admin_router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(geo.router, prefix="/api/v1")
app.include_router(ws.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(analytics.admin_router, prefix="/api/v1")
app.include_router(audit_log.admin_router, prefix="/api/v1")
app.include_router(staff.admin_router, prefix="/api/v1")
app.include_router(trash.admin_router, prefix="/api/v1")

# Anúncios — público (app Daqui) e painel do time interno (ads-admin/),
# prefixos "/ads-admin/*" pra não colidir com auth/staff/audit-logs acima
# (AdAdmin é um ator separado de User, ver core/deps.py).
app.include_router(ads.router, prefix="/api/v1")
app.include_router(ads.admin_router, prefix="/api/v1")
app.include_router(ad_admin_auth.router, prefix="/api/v1")
app.include_router(ad_staff.admin_router, prefix="/api/v1")
app.include_router(ad_audit_log.admin_router, prefix="/api/v1")
app.include_router(ad_geo.admin_router, prefix="/api/v1")

# Arquivos enviados (ex.: fotos de perfil) servidos em /uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/")
def root():
    return {"service": "Daqui API", "version": "1.0.0", "status": "online"}


@app.get("/health")
def health():
    return {"status": "ok"}
