"""Precificação inteligente: preço sempre calculado a partir de parâmetros
(formatos, duração, segmentação, agenda, objetivo, prioridade, concorrência),
nunca uma tabela estática de opções nem um modelo de ML — cada fator é uma
função pura, documentada, limitada a uma faixa razoável (~0.7x-2x) para que o
preço final continue explicável (ver `quote()`, que devolve o detalhamento).

O único fator que consulta o banco é `competition_multiplier` — mas recebe a
contagem já pronta (calculada em `daos/ad.py::count_competing_campaigns`),
então esta função continua pura e testável isoladamente.
"""

FORMAT_DAILY_RATE_CENTS = {
    "post": 500,  # aparece em 2 lugares (feed + pin no mapa) — o mais caro
    "conversation": 300,
    "notification": 250,
    "search_poster": 200,
}

OBJECTIVE_MULTIPLIERS = {
    "reach": 0.9,
    "clicks": 1.0,
    "profile_visits": 1.05,
    "map_opens": 1.05,
    "instagram_opens": 1.1,
    "whatsapp_opens": 1.15,
    "website_opens": 1.15,
}

PEAK_HOURS = set(range(18, 23))  # 18h-22h


def reach_multiplier(targeting: dict) -> float:
    if targeting.get("citywide"):
        m = 3.0
    else:
        m = 1 + 0.15 * max(0, len(targeting.get("neighborhoods", [])) - 1)
    if targeting.get("include_nearby"):
        m *= 1.1
    if targeting.get("audience", "all") != "all":
        m *= 0.9
    if targeting.get("categories"):
        m *= 0.95
    if targeting.get("group_ids"):
        m *= 0.95
    if targeting.get("user_recency", "all") != "all":
        m *= 0.95
    if targeting.get("engagement", "any") == "active":
        m *= 0.95
    return max(0.5, min(m, 4.0))


def competition_multiplier(competing_count: int) -> float:
    return min(1 + 0.1 * competing_count, 1.5)


def seasonality_multiplier(schedule: dict) -> float:
    if schedule.get("special_dates"):
        return 1.15
    days = schedule.get("days_of_week")
    if days is not None and set(days) <= {5, 6}:  # só fim de semana
        return 1.1
    return 1.0


def daypart_multiplier(schedule: dict) -> float:
    hours = schedule.get("hours")
    if hours is None:
        return 1.0
    hours_set = set(hours)
    if hours_set and hours_set <= PEAK_HOURS:
        return 1.15
    if hours_set and not (hours_set & PEAK_HOURS):
        return 0.9
    return 1.0


def objective_multiplier(objective: str) -> float:
    return OBJECTIVE_MULTIPLIERS.get(objective, 1.0)


def priority_multiplier(priority: int) -> float:
    return max(0.7, min(1 + 0.15 * (priority - 3), 1.6))


def frequency_multiplier(
    daily_impression_cap: int | None, per_user_impression_cap: int | None
) -> float:
    m = 1.0
    if per_user_impression_cap is not None:
        if per_user_impression_cap <= 1:
            m *= 1.2
        elif per_user_impression_cap <= 3:
            m *= 1.1
    if daily_impression_cap is not None and daily_impression_cap <= 20:
        m *= 1.05
    return m


DURATION_DISCOUNT_ANCHORS = [
    (1, 1.0),
    (30, 0.95),
    (90, 0.85),
    (180, 0.78),
    (365, 0.7),
    (720, 0.6),
]


def duration_discount(duration_days: int) -> float:
    """Desconto por duração — cresce de forma contínua (interpolação linear
    entre os pontos de `DURATION_DISCOUNT_ANCHORS`), então qualquer dia a
    mais escolhido sempre resulta num preço por dia igual ou menor, sem os
    degraus fixos de antes (onde 29 e 30 dias tinham o mesmo desconto)."""
    d = max(1, duration_days)
    anchors = DURATION_DISCOUNT_ANCHORS
    if d <= anchors[0][0]:
        return anchors[0][1]
    if d >= anchors[-1][0]:
        return anchors[-1][1]
    for (d0, f0), (d1, f1) in zip(anchors, anchors[1:], strict=False):
        if d <= d1:
            t = (d - d0) / (d1 - d0)
            return f0 + t * (f1 - f0)
    return anchors[-1][1]


def quote(
    *,
    formats: list[str],
    duration_days: int,
    targeting: dict,
    schedule: dict,
    objective: str = "clicks",
    priority: int = 3,
    daily_impression_cap: int | None = None,
    per_user_impression_cap: int | None = None,
    competing_count: int = 0,
    market_multiplier: float = 1.0,
) -> dict:
    """Retorna `{price_cents, base_cents, factors: [(label, multiplier), ...]}`.

    `market_multiplier` é o único fator configurável fora desta engine (ver
    "Configurações" no painel — `models/settings.py::AdSettings`), aplicado
    por último para deixar todos os preços proporcionais ao desempenho do
    Daqui sem precisar reajustar cada fator individualmente.
    """
    base_daily = sum(FORMAT_DAILY_RATE_CENTS[f] for f in formats)
    base_cents = round(base_daily * duration_days)

    factors = [
        ("Alcance", reach_multiplier(targeting)),
        ("Concorrência no período/bairros", competition_multiplier(competing_count)),
        ("Sazonalidade", seasonality_multiplier(schedule)),
        ("Horário escolhido", daypart_multiplier(schedule)),
        ("Objetivo da campanha", objective_multiplier(objective)),
        ("Prioridade", priority_multiplier(priority)),
        (
            "Frequência/exclusividade",
            frequency_multiplier(daily_impression_cap, per_user_impression_cap),
        ),
        ("Desconto por duração", duration_discount(duration_days)),
        ("Ajuste de mercado", market_multiplier),
    ]

    price = base_cents
    for _, multiplier in factors:
        price *= multiplier

    return {
        "price_cents": round(price),
        "base_cents": base_cents,
        "factors": factors,
    }


def plan_quote(plan_price_cents: int, plan_duration_days: int, duration_days: int) -> dict:
    """Preço de um plano (valor fixo definido pelo admin) pra uma duração
    customizada pelo anunciante. Mantém `plan_price_cents` exato quando
    `duration_days == plan_duration_days` (preço padrão do plano, do jeito
    que sempre foi), e escala pra qualquer outra duração reaproveitando a
    mesma curva de `duration_discount` — assim o anunciante sempre paga
    menos por dia quanto mais tempo escolher, sem perder o desconto que o
    próprio plano já embutia no preço original."""
    plan_discount = duration_discount(plan_duration_days)
    baseline_daily = plan_price_cents / (plan_duration_days * plan_discount)
    base_cents = round(baseline_daily * duration_days)
    discount = duration_discount(duration_days)
    return {
        "price_cents": round(base_cents * discount),
        "base_cents": base_cents,
        "factors": [("Desconto por duração", discount)],
    }
