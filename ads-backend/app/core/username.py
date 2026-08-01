"""Regra canônica de nome de usuário das contas do painel de anúncios.

Espelha `core/username.py` do backend principal (mesmo formato de handle nos
dois ambientes), como `core/totp.py` espelha o TOTP de lá — os serviços são
independentes, então a regra é duplicada de propósito em vez de importada.

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


def validate(value: str) -> str:
    """Normaliza e valida; levanta ValueError com mensagem amigável."""
    normalized = normalize(value)
    if not USERNAME_RE.match(normalized):
        raise ValueError(MESSAGE)
    return normalized


def suggest_from_email(email: str) -> str:
    """Handle plausível a partir do e-mail (parte antes do @), já saneado.

    Usado como ponto de partida: no bootstrap de contas que existiam antes da
    coluna `username` e no convite de novas contas.
    """
    local = normalize(email).split("@", 1)[0]
    cleaned = re.sub(r"[^a-z0-9._]", "", local).strip("._") or "usuario"
    return cleaned[:18].ljust(3, "0")
