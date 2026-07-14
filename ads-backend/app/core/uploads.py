import secrets

from fastapi import HTTPException, UploadFile

from app.core.config import UPLOAD_DIR

# Extensões de imagem/vídeo aceitas, por mime type.
_IMAGE_EXTS = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
_VIDEO_EXTS = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/x-m4v": "m4v",
}
_MAX_IMAGE_BYTES = 6 * 1024 * 1024  # 6 MB
_MAX_VIDEO_BYTES = 30 * 1024 * 1024  # 30 MB

MEDIA_TYPE_IMAGE = "image"
MEDIA_TYPE_VIDEO = "video"


def save_upload_media(base_url: str, file: UploadFile, prefix: str) -> tuple[str, str]:
    """Salva o criativo (imagem ou vídeo) de um anúncio, via multipart
    (streaming, sem carregar tudo em memória), e devolve `(url_publica, tipo)`.
    """
    mime = (file.content_type or "").lower()
    if mime in _IMAGE_EXTS:
        media_type, ext, max_bytes = MEDIA_TYPE_IMAGE, _IMAGE_EXTS[mime], _MAX_IMAGE_BYTES
    elif mime in _VIDEO_EXTS:
        media_type, ext, max_bytes = MEDIA_TYPE_VIDEO, _VIDEO_EXTS[mime], _MAX_VIDEO_BYTES
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
