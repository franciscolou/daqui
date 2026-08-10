import base64
import binascii
import secrets
from enum import StrEnum

from fastapi import HTTPException, UploadFile

from app.core.config import UPLOAD_DIR


class MediaType(StrEnum):
    IMAGE = "image"
    VIDEO = "video"

# Extensões de imagem aceitas, por mime type.
_IMAGE_EXTS = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
_MAX_IMAGE_BYTES = 6 * 1024 * 1024  # 6 MB

# Extensões de vídeo aceitas, por mime type.
_VIDEO_EXTS = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/x-m4v": "m4v",
}
_MAX_VIDEO_BYTES = 30 * 1024 * 1024  # 30 MB


def is_image_upload(file: UploadFile) -> bool:
    """Só o mime — barato o bastante pra recusar antes de gravar em disco."""
    return (file.content_type or "").lower() in _IMAGE_EXTS


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


def save_upload_media(base_url: str, file: UploadFile, prefix: str) -> tuple[str, MediaType]:
    """Salva uma imagem ou vídeo enviado via multipart (streaming, sem carregar
    tudo em memória) e devolve `(url_publica, tipo)`.
    """
    mime = (file.content_type or "").lower()
    if mime in _IMAGE_EXTS:
        media_type, ext, max_bytes = MediaType.IMAGE, _IMAGE_EXTS[mime], _MAX_IMAGE_BYTES
    elif mime in _VIDEO_EXTS:
        media_type, ext, max_bytes = MediaType.VIDEO, _VIDEO_EXTS[mime], _MAX_VIDEO_BYTES
    else:
        raise HTTPException(status_code=400, detail="Formato de arquivo não suportado")

    filename = f"{prefix}_{secrets.token_hex(8)}.{ext}"
    dest = UPLOAD_DIR / filename
    size = 0
    with dest.open("wb") as out:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > max_bytes:
                out.close()
                dest.unlink(missing_ok=True)
                limit_mb = max_bytes // (1024 * 1024)
                raise HTTPException(
                    status_code=400, detail=f"O arquivo deve ter no máximo {limit_mb} MB"
                )
            out.write(chunk)

    if size == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Arquivo vazio")

    return f"{base_url.rstrip('/')}/uploads/{filename}", media_type
