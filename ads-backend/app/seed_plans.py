"""Cria planos de exemplo (idempotente por slug).
Execute: python -m app.seed_plans

3 categorias × 3 níveis — a tela de anúncios (`/anunciar`) agrupa por
`category` e destaca o plano com `badge` como "mais popular" de cada grupo.
"""

from app.daos import ad as ad_dao
from app.database import SessionLocal, create_tables

PLANS = [
    # ── Comércio local ──────────────────────────────────────────────────
    dict(
        name="Vizinhança",
        slug="local-vizinhanca",
        description="Apareça pra quem passa todo dia perto do seu comércio — post no feed com pin no mapa do seu bairro.",
        price_cents=3_990,
        duration_days=7,
        formats=["post"],
        max_neighborhoods=1,
        category="local_business",
        sort_order=1,
    ),
    dict(
        name="Bairro Plus",
        slug="local-bairro-plus",
        description="Post + notificação na aba Novidades, por 15 dias, em até 3 bairros — o equilíbrio ideal de alcance e preço.",
        price_cents=9_990,
        duration_days=15,
        formats=["post", "notification"],
        max_neighborhoods=3,
        category="local_business",
        badge="Mais popular",
        sort_order=2,
    ),
    dict(
        name="Comércio Premium",
        slug="local-comercio-premium",
        description="Post, conversa e notificação por 30 dias em até 5 bairros — para quem quer virar a referência da região.",
        price_cents=17_990,
        duration_days=30,
        formats=["post", "conversation", "notification"],
        max_neighborhoods=5,
        category="local_business",
        sort_order=3,
    ),
    # ── Anuncie seu evento ──────────────────────────────────────────────
    dict(
        name="Evento Local",
        slug="evento-local",
        description="Encha seu evento de gente do bairro — post com pin no mapa por 5 dias, direto na reta final da divulgação.",
        price_cents=5_990,
        duration_days=5,
        formats=["post"],
        max_neighborhoods=2,
        category="event",
        sort_order=1,
    ),
    dict(
        name="Evento Regional",
        slug="evento-regional",
        description="Post, novidades e poster de busca por 10 dias em até 5 bairros — máxima visibilidade na semana do evento.",
        price_cents=14_990,
        duration_days=10,
        formats=["post", "notification", "search_poster"],
        max_neighborhoods=5,
        category="event",
        badge="Mais popular",
        sort_order=2,
    ),
    dict(
        name="Grande Evento",
        slug="evento-grande",
        description="Todos os 4 formatos, cidade toda, por 15 dias — para eventos que querem lotar e serem notícia em São Paulo.",
        price_cents=29_990,
        duration_days=15,
        formats=["post", "conversation", "notification", "search_poster"],
        max_neighborhoods=None,
        category="event",
        sort_order=3,
    ),
    # ── Grandes empresas ────────────────────────────────────────────────
    dict(
        name="Expansão",
        slug="empresa-expansao",
        description="Post, novidades e poster de busca por 30 dias, cidade toda — construa presença de marca em São Paulo inteira.",
        price_cents=59_990,
        duration_days=30,
        formats=["post", "notification", "search_poster"],
        max_neighborhoods=None,
        category="enterprise",
        sort_order=1,
    ),
    dict(
        name="Autoridade",
        slug="empresa-autoridade",
        description="Todos os 4 formatos por 60 dias, cidade toda — presença constante em todos os pontos de contato do app.",
        price_cents=129_990,
        duration_days=60,
        formats=["post", "conversation", "notification", "search_poster"],
        max_neighborhoods=None,
        category="enterprise",
        badge="Mais popular",
        sort_order=2,
    ),
    dict(
        name="Presença Total",
        slug="empresa-presenca-total",
        description="Todos os 4 formatos por 90 dias, cidade toda — a maior campanha possível no Daqui, para quem não abre mão de liderar.",
        price_cents=249_990,
        duration_days=90,
        formats=["post", "conversation", "notification", "search_poster"],
        max_neighborhoods=None,
        category="enterprise",
        badge="Máximo alcance",
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
