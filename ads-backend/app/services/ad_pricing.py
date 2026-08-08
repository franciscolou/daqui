"""Precificação inteligente: preço sempre calculado a partir de parâmetros
(formatos, duração, segmentação, agenda, objetivo, prioridade, concorrência),
nunca uma tabela estática de opções nem um modelo de ML — cada fator é uma
função pura, documentada, limitada a uma faixa razoável (~0.7x-2x) para que o
preço final continue explicável (ver `quote()`, que devolve o detalhamento).

O único fator que consulta o banco é `competition_multiplier` — mas recebe a
contagem já pronta (calculada em `daos/ad.py::count_competing_campaigns`),
então esta função continua pura e testável isoladamente.
"""

from app.models.ad import (
    AdFormat,
    AdObjective,
    Audience,
    EngagementLevel,
    GeoScope,
    UserRecency,
)

FORMAT_DAILY_RATE_CENTS = {
    AdFormat.POST: 350,  # card no feed — a superfície de maior atenção
    AdFormat.MAP: 350,  # pin no mapa do bairro — o diferencial do Daqui
    AdFormat.NOTIFICATION: 300,
    AdFormat.SEARCH_POSTER: 300,
    AdFormat.CONVERSATION: 250,  # aba Mensagens — a superfície menos acessada
}

# Combo "post + mapa": os dois juntos saem 15% mais baratos que a soma dos
# preços individuais (350 + 350 = 700 → 595/dia). O desconto incide SÓ sobre
# a parcela desses dois formatos — os demais escolhidos na mesma campanha
# continuam custando o preço cheio (ver `format_base`).
POST_MAP_BUNDLE_DISCOUNT = 0.15
BUNDLE_FACTOR_LABEL = "Combo post + mapa"

OBJECTIVE_MULTIPLIERS = {
    AdObjective.REACH: 0.9,
    AdObjective.CLICKS: 1.0,
    AdObjective.PROFILE_VISITS: 1.05,
    AdObjective.MAP_OPENS: 1.05,
    AdObjective.INSTAGRAM_OPENS: 1.1,
    AdObjective.WHATSAPP_OPENS: 1.15,
    AdObjective.WEBSITE_OPENS: 1.15,
}

PEAK_HOURS = set(range(18, 23))  # 18h-22h


def format_base(formats: list[AdFormat]) -> tuple[int, float]:
    """Diária cheia dos formatos escolhidos (soma das tarifas, sem desconto) e
    o multiplicador do combo post+mapa.

    O desconto sai como MULTIPLICADOR (e não já descontado da base) porque
    `quote` expõe cada fator separadamente pro anunciante — e como ele é
    calculado sobre a diária cheia, incidir sobre o preço final equivale
    exatamente a descontar só a parcela de post+mapa, independentemente dos
    outros formatos presentes na mesma campanha."""
    full_daily = sum(FORMAT_DAILY_RATE_CENTS[f] for f in formats)
    if not (AdFormat.POST in formats and AdFormat.MAP in formats) or full_daily <= 0:
        return full_daily, 1.0
    bundle_daily = (
        FORMAT_DAILY_RATE_CENTS[AdFormat.POST] + FORMAT_DAILY_RATE_CENTS[AdFormat.MAP]
    )
    return full_daily, (full_daily - bundle_daily * POST_MAP_BUNDLE_DISCOUNT) / full_daily


NEIGHBORHOOD_GROWTH_RATE = 0.15
CITY_GROWTH_RATE = 0.4

# CITYWIDE/CITIES/COUNTRY costumavam ser multiplicadores soltos (3.0/-/12.0)
# escolhidos à parte da fórmula de bairro. Isso subprecificava escopo largo:
# CITYWIDE=3.0 equivalia, na prática, a comprar só ~15 bairros um a um
# (1 + 0.15*14) — um desconto de volume que ninguém decidiu de propósito,
# porque nenhuma cidade coberta pelo Daqui tem só ~15 bairros ativos.
# Agora CITYWIDE ancora numa estimativa de quantos bairros ativos uma cidade
# coberta costuma ter, e CITIES/COUNTRY continuam crescendo a partir desse
# mesmo patamar — uma única curva, em vez de 3 números desconexos.
#
# São estimativas, não medições: o ads-backend não enxerga a contagem real
# de bairros ativos por cidade (só recebe o nome via query param — ver
# arquitetura em CLAUDE.md). Recalibrar com dado real assim que houver
# telemetria de bairros ativos por cidade coberta.
CITYWIDE_EQUIVALENT_NEIGHBORHOODS = 25
CITYWIDE_MULTIPLIER = 1 + NEIGHBORHOOD_GROWTH_RATE * (CITYWIDE_EQUIVALENT_NEIGHBORHOODS - 1)  # 4.6

COUNTRY_EQUIVALENT_CITIES = 20
COUNTRY_MULTIPLIER = CITYWIDE_MULTIPLIER + CITY_GROWTH_RATE * (COUNTRY_EQUIVALENT_CITIES - 1)  # 12.2


def reach_multiplier(targeting: dict) -> float:
    scope = targeting.get("geo_scope", GeoScope.NEIGHBORHOOD)
    if scope == GeoScope.COUNTRY:
        # Brasil todo — maior salto possível, reflete alcançar toda a base de
        # usuários do app de uma vez, não só uma cidade ou um punhado delas.
        m = COUNTRY_MULTIPLIER
    elif scope == GeoScope.CITIES:
        # Várias cidades específicas (ex.: capitais de vários estados) —
        # cresce por cidade a partir do mesmo patamar de "cidade toda",
        # sem chegar ao alcance de "país todo".
        n = max(1, len(targeting.get("cities", [])))
        m = CITYWIDE_MULTIPLIER + CITY_GROWTH_RATE * (n - 1)
    elif scope == GeoScope.CITYWIDE:
        m = CITYWIDE_MULTIPLIER
    else:
        m = 1 + NEIGHBORHOOD_GROWTH_RATE * max(0, len(targeting.get("neighborhoods", [])) - 1)
    if targeting.get("include_nearby"):
        m *= 1.1
    if targeting.get("audience", Audience.ALL) != Audience.ALL:
        m *= 0.9
    if targeting.get("categories"):
        m *= 0.95
    if targeting.get("user_recency", UserRecency.ALL) != UserRecency.ALL:
        m *= 0.95
    if targeting.get("engagement", EngagementLevel.ANY) == EngagementLevel.ACTIVE:
        m *= 0.95
    return max(0.5, min(m, 13.0))


def competition_multiplier(competing_count: int) -> float:
    return min(1 + 0.1 * competing_count, 1.5)


SPECIAL_DATES_MAX_PREMIUM = 0.3
SPECIAL_DATES_MIN_PREMIUM = 0.05


def seasonality_multiplier(schedule: dict, duration_days: int = 1) -> float:
    """`special_dates`, quando preenchido, SUBSTITUI `hours`/`days_of_week`
    como filtro de exibição (ver `daos/ad.py::_matches_schedule`) — o
    anúncio deixa de rodar todo dia da campanha e passa a rodar SÓ nesses
    dias. Isso é cobrado com um prêmio que escala com o quão concentrada
    fica a entrega: escolher 1 dia num período de 30 é muito mais exclusivo
    (e cobra o prêmio máximo) do que escolher 28 desses 30 dias (quase
    equivalente a não restringir nada, prêmio mínimo). Sem isso, escolher
    mais ou menos datas especiais não mudava nada no preço."""
    dates = schedule.get("special_dates") or []
    if dates:
        fraction = min(1.0, len(set(dates)) / max(1, duration_days))
        return SPECIAL_DATES_MIN_PREMIUM + (SPECIAL_DATES_MAX_PREMIUM - SPECIAL_DATES_MIN_PREMIUM) * (1 - fraction) + 1.0
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


def objective_multiplier(objective: AdObjective) -> float:
    return OBJECTIVE_MULTIPLIERS.get(objective, 1.0)


def priority_multiplier(priority: int) -> float:
    return max(0.7, min(1 + 0.15 * (priority - 3), 1.6))


def frequency_multiplier(per_user_impression_cap: int | None) -> float:
    """Só o limite POR PESSOA pesa no preço: restringir quantas vezes cada
    indivíduo vê o anúncio força alcançar mais gente distinta pra bater o
    mesmo volume — e a curva de alcance é convexa (a próxima pessoa nova é
    sempre mais cara que reimpactar quem já é fácil de alcançar), então isso
    reflete um custo real. Um teto de volume TOTAL do dia (removido — ver
    histórico) não tinha essa mesma justificativa: é só controle de ritmo de
    orçamento, não sinaliza nada mais caro de entregar."""
    if per_user_impression_cap is not None:
        if per_user_impression_cap <= 1:
            return 1.2
        elif per_user_impression_cap <= 3:
            return 1.1
    return 1.0


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
    formats: list[AdFormat],
    duration_days: int,
    targeting: dict,
    schedule: dict,
    objective: AdObjective = AdObjective.CLICKS,
    priority: int = 3,
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
    base_daily, bundle_factor = format_base(formats)
    base_cents = round(base_daily * duration_days)

    # O fator do combo só entra no detalhamento quando existe de fato — um
    # "×1.00" no meio da lista só confundiria quem não escolheu os dois.
    factors = [
        *([(BUNDLE_FACTOR_LABEL, bundle_factor)] if bundle_factor < 1 else []),
        ("Alcance", reach_multiplier(targeting)),
        ("Concorrência no período/bairros", competition_multiplier(competing_count)),
        ("Sazonalidade", seasonality_multiplier(schedule, duration_days)),
        ("Horário escolhido", daypart_multiplier(schedule)),
        ("Objetivo da campanha", objective_multiplier(objective)),
        ("Prioridade", priority_multiplier(priority)),
        ("Frequência/exclusividade", frequency_multiplier(per_user_impression_cap)),
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


def plan_quote(
    plan_price_cents: int,
    plan_duration_days: int,
    duration_days: int,
    *,
    plan_formats: list[AdFormat] | None = None,
    formats: list[AdFormat] | None = None,
) -> dict:
    """Preço de um plano (valor fixo definido pelo admin) pra a duração E os
    formatos que o anunciante escolheu. Mantém `plan_price_cents` exato
    quando nada é alterado (duração e formatos iguais aos do plano — o preço
    padrão anunciado no card), e escala nos dois eixos:

    - duração: reaproveita a curva de `duration_discount`, então sempre sai
      menos por dia quanto mais tempo, sem perder o desconto que o próprio
      plano já embutia no preço original;
    - formatos: proporcional à diária dos formatos escolhidos contra a dos
      formatos do plano (ver `format_base`). Sem isso, tirar ou acrescentar
      uma superfície não mexia em nada no preço — dava pra remover o mapa de
      um plano "post + mapa" e continuar pagando pelos dois.
    """
    plan_discount = duration_discount(plan_duration_days)
    baseline_daily = plan_price_cents / (plan_duration_days * plan_discount)
    base_cents = round(baseline_daily * duration_days)
    discount = duration_discount(duration_days)

    # Ajuste por formato: a diária cheia do que foi escolhido contra a diária
    # JÁ com combo dos formatos do plano (o preço do plano embute o desconto
    # do combo quando ele inclui post+mapa). O fator do combo sai separado,
    # como na engine dinâmica, pra prévia poder mostrar quanto ele economiza.
    format_factors: list[tuple[str, float]] = []
    if plan_formats and formats:
        plan_daily, plan_bundle = format_base(plan_formats)
        chosen_daily, chosen_bundle = format_base(formats)
        plan_effective_daily = plan_daily * plan_bundle
        if plan_effective_daily > 0:
            format_factors.append(
                ("Formatos escolhidos", chosen_daily / plan_effective_daily)
            )
            if chosen_bundle < 1:
                format_factors.append((BUNDLE_FACTOR_LABEL, chosen_bundle))

    price = base_cents * discount
    for _, multiplier in format_factors:
        price *= multiplier
    return {
        "price_cents": round(price),
        "base_cents": base_cents,
        "factors": [("Desconto por duração", discount), *format_factors],
    }
