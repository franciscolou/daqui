"""Mistura Nominatim + HERE para `search()` (autocomplete) e `reverse()`
(coordenadas → bairro).

Nominatim é sempre chamado primeiro (grátis). Sem `HERE_API_KEY` configurada,
este módulo nunca faz uma requisição HTTP a mais em nenhuma das duas funções —
comportamento idêntico ao Nominatim puro. Com a chave configurada, cada função
escala por um motivo diferente: `search()` quando a query tem número de casa
(onde o Nominatim mais falha, ver `nominatim._label`) ou não achou nada;
`reverse()` só quando o Nominatim falhou ou não resolveu bairro nenhum — ali
não existe interpolação de número em jogo, o ponto fraco é resiliência
(Nominatim fora do ar/rate-limited), não qualidade do dado.
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


def reverse(lat: float, lon: float) -> GeoResult | None:
    """Coordenadas → bairro/endereço. Ver módulo acima sobre o gatilho de
    escalada (diferente de `search()`)."""
    result = nominatim.reverse(lat, lon)
    if result and result["neighborhood"]:
        return result
    if not settings.HERE_API_KEY:
        return result
    return here.reverse(lat, lon) or result
