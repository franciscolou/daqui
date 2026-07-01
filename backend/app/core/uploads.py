import base64
import binascii
import secrets

from fastapi import HTTPException

from app.core.config import UPLOAD_DIR

# Extensões de imagem aceitas, por mime type.
_IMAGE_EXTS = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
_MAX_IMAGE_BYTES = 6 * 1024 * 1024  # 6 MB


def save_data_url_image(base_url: str, data_url: str, prefix: str) -> str:
    """Decodifica um data URL base64, grava em UPLOAD_DIR e devolve a URL pública.

    `prefix` prefixa o nome do arquivo (ex.: id do usuário ou "post").
    """
    raw = data_url.strip()
    if raw.startswith("data:"):
        try:
            header, b64 = raw.split(",", 1)
            mime = header[5:].split(";", 1)[0].lower()
        except ValueError:
            raise HTTPException(status_code=400, detail="Imagem inválida") from None
    else:
        mime, b64 = "image/jpeg", raw

    ext = _IMAGE_EXTS.get(mime)
    if not ext:
        raise HTTPException(status_code=400, detail="Formato de imagem não suportado")

    try:
        binary = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Imagem inválida") from None

    if not binary or len(binary) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="A imagem deve ter no máximo 6 MB")

    filename = f"{prefix}_{secrets.token_hex(8)}.{ext}"
    (UPLOAD_DIR / filename).write_bytes(binary)

    return f"{base_url.rstrip('/')}/uploads/{filename}"
