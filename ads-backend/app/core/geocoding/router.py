"""Mistura Nominatim + HERE só para `search()` (autocomplete de endereço).

Nominatim é sempre chamado primeiro (grátis). HERE só entra quando já
configurado (`HERE_API_KEY`) e quando vale a pena pagar a chamada: a query já
tem um número de casa (onde o Nominatim mais falha, ver `nominatim._label`),
ou o Nominatim não achou nada. Sem chave configurada, este módulo nunca faz
uma requisição HTTP a mais — comportamento idêntico ao Nominatim puro.
"""
from __future__ import annotations

import re

from app.core.config import settings

from . import here, nominatim
from .types import GeoResult

_HOUSE_NUMBER_RE = re.compile(r"\d")


def expects_here(query: str) -> bool:
    """A query tem número de casa e há chave configurada — ou seja, o HERE
    DEVERIA ter respondido.

    Quem cacheia usa isto pra reconhecer um resultado degradado: se o HERE era
    esperado mas nenhuma sugestão dele entrou (chave recém-configurada, cota
    estourada, timeout — `here.search` é tolerante e devolve [] em silêncio),
    o resultado só-Nominatim não pode ser gravado com o TTL longo, senão fica
    servido por 60 dias sem número de casa. Ver `services/geo.py`.
    """
    return bool(settings.HERE_API_KEY) and bool(_HOUSE_NUMBER_RE.search(query))


def search(query: str, limit: int = 10) -> list[GeoResult]:
    nominatim_results = nominatim.search(query, limit=limit)
    should_escalate = bool(settings.HERE_API_KEY) and (
        bool(_HOUSE_NUMBER_RE.search(query)) or not nominatim_results
    )
    if not should_escalate:
        return nominatim_results
    here_results = here.search(query, limit=limit)
    # HERE primeiro: é o motivo de termos pago pela chamada — a sugestão com
    # número exato deve ganhar o dedupe por label em services/geo.py.
    return here_results + nominatim_results
