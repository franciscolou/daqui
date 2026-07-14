from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_tables
from app.routers import ads, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


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


@app.get("/")
def root():
    return {"service": "Daqui Ads API", "version": "1.0.0", "status": "online"}


@app.get("/health")
def health():
    return {"status": "ok"}
