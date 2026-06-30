from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_tables
from app.routers import auth, comments, messages, notifications, posts, users


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
app.include_router(users.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(comments.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"service": "Daqui API", "version": "1.0.0", "status": "online"}


@app.get("/health")
def health():
    return {"status": "ok"}
