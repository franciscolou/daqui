"""Validação de ID token do Google (login/cadastro via "Entrar com Google").

Verifica assinatura, emissor e público-alvo localmente contra o JWKS público
do Google — evita depender do endpoint /tokeninfo (rate-limited, recomendado
pelo próprio Google só para debug) e não precisa de uma lib nova: python-jose
(já usado no resto do projeto) sabe montar a chave a partir do JWK cru.
"""

import time

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings

_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
_JWKS_TTL_SECONDS = 3600

# Cache em memória do JWKS — as chaves de assinatura do Google giram raramente;
# refazer esse round-trip a cada tentativa de login seria desperdício.
_jwks_cache: dict = {"keys": [], "fetched_at": 0.0}


def _fetch_jwks() -> list[dict]:
    resp = httpx.get(_JWKS_URL, timeout=10)
    resp.raise_for_status()
    return resp.json()["keys"]


def _get_key(kid: str | None) -> dict | None:
    now = time.time()
    if now - _jwks_cache["fetched_at"] > _JWKS_TTL_SECONDS:
        _jwks_cache["keys"] = _fetch_jwks()
        _jwks_cache["fetched_at"] = now
    key = next((k for k in _jwks_cache["keys"] if k.get("kid") == kid), None)
    if key is not None:
        return key
    # kid pode ter girado entre o cache e agora — uma tentativa extra força o refresh.
    _jwks_cache["keys"] = _fetch_jwks()
    _jwks_cache["fetched_at"] = now
    return next((k for k in _jwks_cache["keys"] if k.get("kid") == kid), None)


_INVALID_TOKEN = "Token do Google inválido ou expirado."


def verify_id_token(token: str) -> dict:
    """Valida um ID token do Google e devolve o payload (sub/email/name/picture/
    email_verified). Levanta HTTPException(401) se inválido, ou 501 se o
    login com Google não estiver configurado neste ambiente."""
    if not settings.GOOGLE_WEB_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Login com Google não está configurado neste ambiente.",
        )
    try:
        header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(status_code=401, detail=_INVALID_TOKEN) from None

    key = _get_key(header.get("kid"))
    if key is None:
        raise HTTPException(status_code=401, detail=_INVALID_TOKEN)

    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.GOOGLE_WEB_CLIENT_ID,
        )
    except JWTError:
        raise HTTPException(status_code=401, detail=_INVALID_TOKEN) from None

    if payload.get("iss") not in _ISSUERS:
        raise HTTPException(status_code=401, detail=_INVALID_TOKEN)
    return payload
