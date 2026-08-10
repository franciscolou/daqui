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


def suggest_from_email(email: str) -> str:
    """Handle plausível a partir do e-mail (parte antes do @), já saneado.

    Usado como ponto de partida: no bootstrap de contas que existiam antes da
    coluna `username` e no convite de novas contas (User e AdAdmin).
    """
    local = normalize(email).split("@", 1)[0]
    cleaned = re.sub(r"[^a-z0-9._]", "", local).strip("._") or "usuario"
    return cleaned[:18].ljust(3, "0")


def mention_pattern(handle: str) -> re.Pattern[str]:
    """Casa exatamente `@handle` dentro de um texto já publicado.

    Mesmas bordas de `services/mentions.py::MENTION_RE` (nada de `\\w` ou `@`
    antes, pra não pegar e-mail; nada do alfabeto de username depois, pra
    `@ana` não casar dentro de `@ana.silva`). Usado ao renomear uma conta —
    ver `daos/mention.py`.
    """
    return re.compile(rf"(?<![\w@])@{re.escape(handle)}(?![a-zA-Z0-9._])", re.IGNORECASE)
