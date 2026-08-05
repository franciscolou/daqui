"""Cria planos de exemplo (idempotente por slug).
Execute: python -m app.seed_plans

4 categorias — a tela de anúncios (`/advertise`) agrupa por `category` e
destaca o plano com `badge` como "mais popular" de cada grupo. local_business
tem 4 níveis, event e enterprise têm 3 cada, todas escopadas a uma única
cidade (bairro(s) ou cidade toda). A 4ª ("national") é o novo patamar de
preço para quem quer sair de uma cidade só — 2 níveis de "várias cidades"
(`geo_scope="cities"`, com `max_cities` diferente) e o topo em "Brasil todo"
(`geo_scope="country"`, sem limite de área nenhum). Os planos nacionais são os
únicos sem o formato "map": um pin só faz sentido pra quem anuncia um ponto
específico, não pra uma marca espalhada por 15 cidades.

`price_cents` NÃO é mais escolhido à mão: `_plan_price()` chama a mesma
`ad_pricing.quote()` usada pelo configurador dinâmico, com os parâmetros
canônicos do próprio plano (todos os bairros/cidades que ele permite, sem
filtro extra de audiência/agenda), e aplica um desconto fixo de pacote
(`PLAN_DISCOUNT`). Isso existe porque os preços fixos anteriores foram
escolhidos "no olho" e divergiam da engine em qualquer direção — de -50% a
+169% dependendo do plano — o que fazia o mesmo produto custar preços
inconsistentes dependendo se o anunciante escolhia o plano pronto ou montava
a campanha do zero no configurador. Com o preço derivado da engine, essa
divergência vira uma única % previsível (o desconto de pacote), igual para
todo plano."""

from app.daos import ad as ad_dao
from app.database import SessionLocal, create_tables
from app.models.ad import (
    AdFormat,
    AdPlanCategory,
    GeoScope,
    default_schedule,
    default_targeting,
)
from app.services import ad_pricing

# Desconto de pacote sobre o preço que a engine dinâmica cobraria pelos
# mesmos parâmetros — mesma taxa do combo post+mapa (`POST_MAP_BUNDLE_DISCOUNT`
# em `services/ad_pricing.py`), reaproveitada aqui só por consistência de
# "número redondo já usado no sistema", não por acoplamento entre os dois.
# Recompensa quem compra o pacote pronto em vez de configurar do zero, mas —
# ao contrário do esquema anterior — na MESMA proporção pra todo plano.
PLAN_DISCOUNT = 0.85


def _plan_price(
    formats: list[AdFormat],
    duration_days: int,
    geo_scope: GeoScope,
    *,
    max_neighborhoods: int | None = None,
    max_cities: int | None = None,
) -> int:
    """Preço do plano = `ad_pricing.quote()` nos parâmetros canônicos do
    plano (usa TODOS os bairros/cidades que ele permite — o teto que o
    anunciante pode escolher — sem nenhum filtro extra de audiência,
    categoria ou agenda) menos o desconto de pacote, arredondado pro
    "-,90" mais próximo por cima (mesma convenção de preço que os planos já
    usavam)."""
    targeting = default_targeting()
    targeting["geo_scope"] = geo_scope
    if geo_scope == GeoScope.NEIGHBORHOOD:
        targeting["neighborhoods"] = [f"b{i}" for i in range(max(1, max_neighborhoods or 1))]
    elif geo_scope == GeoScope.CITIES:
        targeting["cities"] = [f"c{i}" for i in range(max(1, max_cities or 1))]
    result = ad_pricing.quote(
        formats=formats,
        duration_days=duration_days,
        targeting=targeting,
        schedule=default_schedule(),
    )
    return _charm_price(round(result["price_cents"] * PLAN_DISCOUNT))


def _charm_price(cents: int) -> int:
    """Arredonda pro próximo real cheio menos 10 centavos (ex.: 3659 →
    3690 = R$36,90) — preço "-,90" sem reintroduzir valores escolhidos à
    mão."""
    reais = -(-cents // 100)  # ceil(cents / 100)
    return reais * 100 - 10


PLANS = [
    # ── Comércio local ──────────────────────────────────────────────────
    dict(
        name="No Mapa",
        slug="local-no-mapa",
        description="Só o pin no mapa do bairro, por 10 dias — o jeito mais barato de quem tem endereço fixo aparecer pra quem está por perto.",
        price_cents=_plan_price([AdFormat.MAP], 10, GeoScope.NEIGHBORHOOD, max_neighborhoods=1),
        duration_days=10,
        formats=[AdFormat.MAP],
        geo_scope=GeoScope.NEIGHBORHOOD,
        max_neighborhoods=1,
        category=AdPlanCategory.LOCAL_BUSINESS,
        sort_order=0,
    ),
    dict(
        name="Vizinhança",
        slug="local-vizinhanca",
        description="Apareça para quem passa todo dia perto do seu comércio — post no feed com pin no mapa do seu bairro.",
        price_cents=_plan_price([AdFormat.POST, AdFormat.MAP], 7, GeoScope.NEIGHBORHOOD, max_neighborhoods=1),
        duration_days=7,
        formats=[AdFormat.POST, AdFormat.MAP],
        geo_scope=GeoScope.NEIGHBORHOOD,
        max_neighborhoods=1,
        category=AdPlanCategory.LOCAL_BUSINESS,
        sort_order=1,
    ),
    dict(
        name="Bairro Plus",
        slug="local-bairro-plus",
        description="Post, pin no mapa e notificação na aba Novidades, por 15 dias, em até 3 bairros — o equilíbrio ideal de alcance e preço.",
        price_cents=_plan_price(
            [AdFormat.POST, AdFormat.MAP, AdFormat.NOTIFICATION],
            15,
            GeoScope.NEIGHBORHOOD,
            max_neighborhoods=3,
        ),
        duration_days=15,
        formats=[AdFormat.POST, AdFormat.MAP, AdFormat.NOTIFICATION],
        geo_scope=GeoScope.NEIGHBORHOOD,
        max_neighborhoods=3,
        category=AdPlanCategory.LOCAL_BUSINESS,
        badge="Mais popular",
        sort_order=2,
    ),
    dict(
        name="Comércio Premium",
        slug="local-comercio-premium",
        description="Post, pin no mapa, conversa e notificação por 30 dias em até 5 bairros — para quem quer virar a referência da região.",
        price_cents=_plan_price(
            [AdFormat.POST, AdFormat.MAP, AdFormat.CONVERSATION, AdFormat.NOTIFICATION],
            30,
            GeoScope.NEIGHBORHOOD,
            max_neighborhoods=5,
        ),
        duration_days=30,
        formats=[AdFormat.POST, AdFormat.MAP, AdFormat.CONVERSATION, AdFormat.NOTIFICATION],
        geo_scope=GeoScope.NEIGHBORHOOD,
        max_neighborhoods=5,
        category=AdPlanCategory.LOCAL_BUSINESS,
        sort_order=3,
    ),
    # ── Anuncie seu evento ──────────────────────────────────────────────
    dict(
        name="Evento Local",
        slug="evento-local",
        description="Encha seu evento de gente do bairro — post com pin no mapa por 5 dias, direto na reta final da divulgação.",
        price_cents=_plan_price([AdFormat.POST, AdFormat.MAP], 5, GeoScope.NEIGHBORHOOD, max_neighborhoods=2),
        duration_days=5,
        formats=[AdFormat.POST, AdFormat.MAP],
        geo_scope=GeoScope.NEIGHBORHOOD,
        max_neighborhoods=2,
        category=AdPlanCategory.EVENT,
        sort_order=1,
    ),
    dict(
        name="Evento Regional",
        slug="evento-regional",
        description="Post, pin no mapa, novidades e poster de busca por 10 dias em até 5 bairros — máxima visibilidade na semana do evento.",
        price_cents=_plan_price(
            [AdFormat.POST, AdFormat.MAP, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
            10,
            GeoScope.NEIGHBORHOOD,
            max_neighborhoods=5,
        ),
        duration_days=10,
        formats=[AdFormat.POST, AdFormat.MAP, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
        geo_scope=GeoScope.NEIGHBORHOOD,
        max_neighborhoods=5,
        category=AdPlanCategory.EVENT,
        badge="Mais popular",
        sort_order=2,
    ),
    dict(
        name="Grande Evento",
        slug="evento-grande",
        description="Todos os 5 formatos, cidade toda, por 15 dias — para eventos que querem lotar e serem notícia na cidade.",
        price_cents=_plan_price(
            [AdFormat.POST, AdFormat.MAP, AdFormat.CONVERSATION, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
            15,
            GeoScope.CITYWIDE,
        ),
        duration_days=15,
        formats=[AdFormat.POST, AdFormat.MAP, AdFormat.CONVERSATION, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
        geo_scope=GeoScope.CITYWIDE,
        category=AdPlanCategory.EVENT,
        sort_order=3,
    ),
    # ── Grandes empresas ────────────────────────────────────────────────
    dict(
        name="Expansão",
        slug="empresa-expansao",
        description="Post, pin no mapa, novidades e poster de busca por 30 dias, cidade toda — construa presença de marca na sua cidade inteira.",
        price_cents=_plan_price(
            [AdFormat.POST, AdFormat.MAP, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
            30,
            GeoScope.CITYWIDE,
        ),
        duration_days=30,
        formats=[AdFormat.POST, AdFormat.MAP, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
        geo_scope=GeoScope.CITYWIDE,
        category=AdPlanCategory.ENTERPRISE,
        sort_order=1,
    ),
    dict(
        name="Autoridade",
        slug="empresa-autoridade",
        description="Todos os 5 formatos por 60 dias, cidade toda — presença constante em todos os pontos de contato do app.",
        price_cents=_plan_price(
            [AdFormat.POST, AdFormat.MAP, AdFormat.CONVERSATION, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
            60,
            GeoScope.CITYWIDE,
        ),
        duration_days=60,
        formats=[AdFormat.POST, AdFormat.MAP, AdFormat.CONVERSATION, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
        geo_scope=GeoScope.CITYWIDE,
        category=AdPlanCategory.ENTERPRISE,
        badge="Mais popular",
        sort_order=2,
    ),
    dict(
        name="Presença Total",
        slug="empresa-presenca-total",
        description="Todos os 5 formatos por 90 dias, cidade toda — a maior campanha possível numa única cidade, para quem não abre mão de liderar por lá.",
        price_cents=_plan_price(
            [AdFormat.POST, AdFormat.MAP, AdFormat.CONVERSATION, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
            90,
            GeoScope.CITYWIDE,
        ),
        duration_days=90,
        formats=[AdFormat.POST, AdFormat.MAP, AdFormat.CONVERSATION, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
        geo_scope=GeoScope.CITYWIDE,
        category=AdPlanCategory.ENTERPRISE,
        badge="Máximo alcance",
        sort_order=3,
    ),
    # ── Alcance nacional (várias cidades ou Brasil todo) ────────────────
    dict(
        name="Rede Regional",
        slug="nacional-rede-regional",
        description="Post e novidades por 30 dias em até 5 cidades — ideal pra quem tem loja ou franquia em mais de uma cidade.",
        price_cents=_plan_price(
            [AdFormat.POST, AdFormat.NOTIFICATION], 30, GeoScope.CITIES, max_cities=5
        ),
        duration_days=30,
        formats=[AdFormat.POST, AdFormat.NOTIFICATION],
        geo_scope=GeoScope.CITIES,
        max_cities=5,
        category=AdPlanCategory.NATIONAL,
        sort_order=1,
    ),
    dict(
        name="Metrópoles Brasil",
        slug="nacional-metropoles",
        description="Post, conversa, novidades e poster de busca por 45 dias em até 15 cidades — cubra as principais capitais e metrópoles do país de uma vez.",
        price_cents=_plan_price(
            [AdFormat.POST, AdFormat.CONVERSATION, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
            45,
            GeoScope.CITIES,
            max_cities=15,
        ),
        duration_days=45,
        formats=[AdFormat.POST, AdFormat.CONVERSATION, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
        geo_scope=GeoScope.CITIES,
        max_cities=15,
        category=AdPlanCategory.NATIONAL,
        badge="Mais popular",
        sort_order=2,
    ),
    dict(
        name="Brasil Todo",
        slug="nacional-brasil-todo",
        description="Post, conversa, novidades e poster de busca por 60 dias, em qualquer cidade do país — o maior alcance possível no Daqui, sem limite de área.",
        price_cents=_plan_price(
            [AdFormat.POST, AdFormat.CONVERSATION, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
            60,
            GeoScope.COUNTRY,
        ),
        duration_days=60,
        formats=[AdFormat.POST, AdFormat.CONVERSATION, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
        geo_scope=GeoScope.COUNTRY,
        category=AdPlanCategory.NATIONAL,
        badge="Alcance nacional",
        sort_order=3,
    ),
]


def seed_plans():
    create_tables()
    db = SessionLocal()
    try:
        for data in PLANS:
            if ad_dao.get_plan_by_slug(db, data["slug"]):
                print(f"• plano '{data['slug']}' já existe, pulando.")
                continue
            ad_dao.create_plan(db, **data)
            print(f"✅ plano '{data['slug']}' criado.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_plans()
