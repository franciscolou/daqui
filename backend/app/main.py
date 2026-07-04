from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import UPLOAD_DIR
from app.database import create_tables
from app.routers import (
    auth,
    comments,
    geo,
    groups,
    messages,
    notifications,
    posts,
    reports,
    reviews,
    search,
    users,
    ws,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


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
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(comments.router, prefix="/api/v1")
app.include_router(comments.admin_router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(geo.router, prefix="/api/v1")
app.include_router(ws.router, prefix="/api/v1")

# Arquivos enviados (ex.: fotos de perfil) servidos em /uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/")
def root():
    return {"service": "Daqui API", "version": "1.0.0", "status": "online"}


@app.get("/health")
def health():
    return {"status": "ok"}
