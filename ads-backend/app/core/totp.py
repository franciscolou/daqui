"""TOTP (RFC 6238) implementado com a biblioteca padrão — evita dependência extra.

Compatível com Google Authenticator, Authy, 1Password etc. (SHA1, 6 dígitos,
janela de 30s). Usado pela A2F (autenticação de dois fatores). Espelha
`backend/app/core/totp.py`.
"""
import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

_DIGITS = 6
_PERIOD = 30
# Segredo base32 sem padding: 20 bytes = 32 caracteres (recomendado pela RFC 4226).
_SECRET_BYTES = 20


def generate_secret() -> str:
    """Gera um novo segredo base32 (sem '=') para provisionar em um app autenticador."""
    return base64.b32encode(secrets.token_bytes(_SECRET_BYTES)).decode("ascii").rstrip("=")


def _hotp(secret: str, counter: int) -> str:
    # Base32 exige padding múltiplo de 8 para decodificar.
    padded = secret + "=" * (-len(secret) % 8)
    key = base64.b32decode(padded, casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10**_DIGITS)).zfill(_DIGITS)


def verify(secret: str, code: str, *, window: int = 1) -> bool:
    """Valida um código, tolerando ±`window` períodos de defasagem de relógio."""
    code = (code or "").strip().replace(" ", "")
    if not code.isdigit() or len(code) != _DIGITS:
        return False
    counter = int(time.time() // _PERIOD)
    for drift in range(-window, window + 1):
        if hmac.compare_digest(_hotp(secret, counter + drift), code):
            return True
    return False


def provisioning_uri(secret: str, *, account: str, issuer: str = "Daqui Ads") -> str:
    """URI otpauth:// para QR code / entrada manual no app autenticador."""
    label = quote(f"{issuer}:{account}")
    params = f"secret={secret}&issuer={quote(issuer)}&digits={_DIGITS}&period={_PERIOD}"
    return f"otpauth://totp/{label}?{params}"
