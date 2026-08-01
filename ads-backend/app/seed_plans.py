"""Cria planos de exemplo (idempotente por slug).
Execute: python -m app.seed_plans

4 categorias — a tela de anúncios (`/advertise`) agrupa por `category` e
destaca o plano com `badge` como "mais popular" de cada grupo. As 3 primeiras
(local_business/event/enterprise) têm 3 níveis cada, todas escopadas a uma
única cidade (bairro(s) ou cidade toda). A 4ª ("national") é o novo patamar
de preço para quem quer sair de uma cidade só — 2 níveis de "várias cidades"
(`geo_scope="cities"`, com `max_cities` diferente) e o topo em "Brasil todo"
(`geo_scope="country"`, sem limite de área nenhum). Os planos nacionais são os
únicos sem o formato "map": um pin só faz sentido pra quem anuncia um ponto
específico, não pra uma marca espalhada por 15 cidades.
"""

from app.daos import ad as ad_dao
from app.database import SessionLocal, create_tables
from app.models.ad import AdFormat, AdPlanCategory, GeoScope

PLANS = [
    # ── Comércio local ──────────────────────────────────────────────────
    dict(
        name="No Mapa",
        slug="local-no-mapa",
        description="Só o pin no mapa do bairro, por 15 dias — o jeito mais barato de quem tem endereço fixo aparecer pra quem está por perto.",
        price_cents=2_490,
        duration_days=15,
        formats=[AdFormat.MAP],
        geo_scope=GeoScope.NEIGHBORHOOD,
        max_neighborhoods=1,
        category=AdPlanCategory.LOCAL_BUSINESS,
        sort_order=0,
    ),
    dict(
        name="Vizinhança",
        slug="local-vizinhanca",
        description="Apareça pra quem passa todo dia perto do seu comércio — post no feed com pin no mapa do seu bairro.",
        price_cents=3_990,
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
        price_cents=9_990,
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
        price_cents=17_990,
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
        price_cents=5_990,
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
        price_cents=14_990,
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
        price_cents=29_990,
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
        price_cents=59_990,
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
        price_cents=129_990,
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
        price_cents=249_990,
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
        price_cents=79_990,
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
        price_cents=299_990,
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
        price_cents=799_990,
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
