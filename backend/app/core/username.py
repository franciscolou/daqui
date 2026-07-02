"""Regra canônica de nome de usuário (username), compartilhada pelo cadastro e
pela edição de perfil.

3–18 caracteres: apenas letras minúsculas, números, ponto ou sublinhado.
"""
import re

USERNAME_RE = re.compile(r"^[a-z0-9._]{3,18}$")
MESSAGE = (
    "O nome de usuário deve ter de 3 a 18 caracteres, apenas letras "
    "minúsculas, números, ponto ou sublinhado."
)


def normalize(value: str) -> str:
    return (value or "").strip().lower()


def validation_error(value: str) -> str | None:
    """Mensagem de erro de formato, ou None se o formato é válido."""
    if not USERNAME_RE.match(normalize(value)):
        return MESSAGE
    return None


def validate(value: str) -> str:
    """Normaliza e valida; levanta ValueError com mensagem amigável."""
    normalized = normalize(value)
    if not USERNAME_RE.match(normalized):
        raise ValueError(MESSAGE)
    return normalized
