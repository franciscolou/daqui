"""Popula campanhas de exemplo (anunciantes fictícios), pra ter dado real
pra olhar no painel `ads-admin` e nos formatos de anúncio no app.
Idempotente: pula se já existir alguma campanha com e-mail @seed.daqui.com.
Execute: python -m app.seed_ads_campaigns
"""

from datetime import datetime, timedelta, timezone

from app.daos import ad as ad_dao
from app.database import SessionLocal
from app.models.ad import (
    AdCampaignStatus,
    AdFormat,
    AdObjective,
    GeoScope,
    PaymentProvider,
    default_schedule,
    default_targeting,
)

SEED_EMAIL_DOMAIN = "@seed.daqui.com"

now = datetime.now(timezone.utc)


def _targeting(*, neighborhoods=None, citywide=False, city="São Paulo") -> dict:
    t = default_targeting()
    if citywide:
        t["geo_scope"] = GeoScope.CITYWIDE
        t["city"] = city
    else:
        t["geo_scope"] = GeoScope.NEIGHBORHOOD
        t["neighborhoods"] = neighborhoods or []
    return t


CAMPAIGNS = [
    dict(
        advertiser_name="Padaria Pão Nosso",
        advertiser_email=f"contato@paonosso{SEED_EMAIL_DOMAIN}",
        advertiser_phone="21 98877-1122",
        plan_slug="local-vizinhanca",
        formats=[AdFormat.POST, AdFormat.MAP],
        price_cents=3_990,
        duration_days=7,
        targeting=_targeting(neighborhoods=["Leme"]),
        status=AdCampaignStatus.ACTIVE,
        started_days_ago=2,
        objective=AdObjective.CLICKS,
        creative=dict(
            title="Pão quentinho todo dia, direto do forno",
            content="Padaria Pão Nosso: pães artesanais, café da manhã e encomendas para festas. Vem conferir!",
            image_url="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800",
            cta_label="Ver cardápio",
            target_url="https://wa.me/5521988771122",
            latitude=-22.9641279,
            longitude=-43.1731249,
        ),
    ),
    # Só pin no mapa, sem post no feed — o caso que a separação post/mapa
    # tornou possível (ver AdFormat em models/ad.py).
    dict(
        advertiser_name="Chaveiro 24h do Leme",
        advertiser_email=f"contato@chaveiro24hleme{SEED_EMAIL_DOMAIN}",
        advertiser_phone="21 99911-4455",
        plan_slug="local-no-mapa",
        formats=[AdFormat.MAP],
        price_cents=2_490,
        duration_days=15,
        targeting=_targeting(neighborhoods=["Leme"]),
        status=AdCampaignStatus.ACTIVE,
        started_days_ago=4,
        objective=AdObjective.MAP_OPENS,
        creative=dict(
            title="Chaveiro 24h — abertura de portas e cópias na hora",
            content="Atendimento a qualquer hora, sem taxa de deslocamento no Leme e arredores.",
            image_url=None,
            cta_label="Chamar no WhatsApp",
            target_url="https://wa.me/5521999114455",
            latitude=-22.9615,
            longitude=-43.1668,
        ),
    ),
    dict(
        advertiser_name="Pet Shop Amigo Fiel",
        advertiser_email=f"marketing@amigofiel{SEED_EMAIL_DOMAIN}",
        advertiser_phone="11 97766-2233",
        plan_slug="local-bairro-plus",
        formats=[AdFormat.POST, AdFormat.MAP, AdFormat.NOTIFICATION],
        price_cents=9_990,
        duration_days=15,
        targeting=_targeting(neighborhoods=["Pinheiros", "Jardins", "Vila Madalena"]),
        status=AdCampaignStatus.ACTIVE,
        started_days_ago=5,
        objective=AdObjective.WHATSAPP_OPENS,
        creative=dict(
            title="Banho e tosa com 20% OFF essa semana",
            content="Agende pelo WhatsApp e garanta desconto para o seu pet. Ração, brinquedos e acessórios também com preço especial.",
            image_url="https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800",
            cta_label="Chamar no WhatsApp",
            target_url="https://wa.me/5511977662233",
            latitude=-23.5462839,
            longitude=-46.7237281,
        ),
    ),
    dict(
        advertiser_name="Feira de Vinil Vila Madalena",
        advertiser_email=f"organizacao@feiravinil{SEED_EMAIL_DOMAIN}",
        advertiser_phone="11 96655-3344",
        plan_slug=None,
        formats=[AdFormat.POST, AdFormat.MAP],
        price_cents=4_500,
        duration_days=5,
        targeting=_targeting(neighborhoods=["Vila Madalena"]),
        status=AdCampaignStatus.ACTIVE,
        started_days_ago=1,
        objective=AdObjective.MAP_OPENS,
        creative=dict(
            title="Feira de Vinil e Discos Raros — Sábado, o dia todo",
            content="Mais de 40 expositores, food trucks e DJ set na Praça Benedito Calixto. Entrada gratuita.",
            image_url=None,
            video_url="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
            cta_label="Ver no mapa",
            target_url="https://instagram.com/feiravinilvm",
            latitude=-23.5570,
            longitude=-46.6890,
        ),
    ),
    dict(
        advertiser_name="Academia PowerFit Jardins",
        advertiser_email=f"comercial@powerfit{SEED_EMAIL_DOMAIN}",
        advertiser_phone="11 95544-4455",
        plan_slug="local-comercio-premium",
        formats=[AdFormat.POST, AdFormat.MAP, AdFormat.CONVERSATION, AdFormat.NOTIFICATION],
        price_cents=17_990,
        duration_days=30,
        targeting=_targeting(neighborhoods=["Jardins"]),
        status=AdCampaignStatus.PAUSED,
        started_days_ago=10,
        objective=AdObjective.PROFILE_VISITS,
        creative=dict(
            title="Matricule-se com a primeira semana grátis",
            content="Musculação, crossfit e aulas coletivas. Estrutura completa a poucos passos de você.",
            image_url="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800",
            cta_label="Saiba mais",
            target_url="https://powerfitjardins.com.br",
            latitude=-23.5671492,
            longitude=-46.6644067,
        ),
    ),
    dict(
        advertiser_name="Festival de Inverno do Leme",
        advertiser_email=f"producao@festivalleme{SEED_EMAIL_DOMAIN}",
        advertiser_phone="21 94433-5566",
        plan_slug="evento-regional",
        formats=[AdFormat.POST, AdFormat.MAP, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
        price_cents=14_990,
        duration_days=10,
        targeting=_targeting(neighborhoods=["Leme", "Copacabana", "Botafogo"]),
        status=AdCampaignStatus.ACTIVE,
        started_days_ago=3,
        objective=AdObjective.REACH,
        creative=dict(
            title="Festival de Inverno do Leme — shows gratuitos na praia",
            content="Três dias de música ao vivo, gastronomia local e artesanato. Programação completa no site.",
            image_url="https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800",
            cta_label="Ver programação",
            target_url="https://festivaldoleme.com.br",
            latitude=-22.9620576,
            longitude=-43.169373,
        ),
    ),
    dict(
        advertiser_name="Imobiliária Horizonte SP",
        advertiser_email=f"ads@horizonteimoveis{SEED_EMAIL_DOMAIN}",
        advertiser_phone="11 93322-6677",
        plan_slug="empresa-expansao",
        formats=[AdFormat.POST, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
        price_cents=59_990,
        duration_days=30,
        targeting=_targeting(citywide=True),
        status=AdCampaignStatus.PENDING_PAYMENT,
        started_days_ago=None,
        objective=AdObjective.WEBSITE_OPENS,
        creative=dict(
            title="Encontre seu apartamento ideal em São Paulo",
            content="Mais de 500 imóveis para compra e aluguel, com visita agendada em minutos pelo app.",
            image_url="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800",
            cta_label="Ver imóveis",
            target_url="https://horizonteimoveis.com.br",
            latitude=None,
            longitude=None,
        ),
    ),
    dict(
        advertiser_name="Vila Boutique",
        advertiser_email=f"loja@vilaboutique{SEED_EMAIL_DOMAIN}",
        advertiser_phone="11 92211-7788",
        plan_slug="local-vizinhanca",
        formats=[AdFormat.POST, AdFormat.MAP],
        price_cents=3_990,
        duration_days=7,
        targeting=_targeting(neighborhoods=["Vila Madalena"]),
        status=AdCampaignStatus.EXPIRED,
        started_days_ago=25,
        objective=AdObjective.CLICKS,
        creative=dict(
            title="Coleção de inverno chegou — até 30% OFF",
            content="Peças exclusivas de estilistas locais. Vem experimentar, a loja é pertinho de você.",
            image_url="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800",
            cta_label="Ver coleção",
            target_url="https://instagram.com/vilaboutique",
            latitude=-23.5560,
            longitude=-46.6900,
        ),
    ),
    dict(
        advertiser_name="Clínica Odonto Sorriso",
        advertiser_email=f"contato@odontosorriso{SEED_EMAIL_DOMAIN}",
        advertiser_phone="11 91100-8899",
        plan_slug=None,
        formats=[AdFormat.CONVERSATION],
        price_cents=6_500,
        duration_days=20,
        targeting=_targeting(neighborhoods=["Pinheiros"]),
        status=AdCampaignStatus.ACTIVE,
        started_days_ago=7,
        objective=AdObjective.WHATSAPP_OPENS,
        creative=dict(
            title="Avaliação odontológica gratuita esse mês",
            content="Clareamento, ortodontia e implantes. Agende sua consulta sem compromisso.",
            image_url=None,
            cta_label="Agendar consulta",
            target_url="https://wa.me/5511911008899",
            latitude=None,
            longitude=None,
        ),
    ),
    dict(
        advertiser_name="Mercado Orgânico Jardins",
        advertiser_email=f"vendas@mercadoorganico{SEED_EMAIL_DOMAIN}",
        advertiser_phone="11 90099-9900",
        plan_slug="local-vizinhanca",
        formats=[AdFormat.POST, AdFormat.MAP],
        price_cents=3_990,
        duration_days=7,
        targeting=_targeting(neighborhoods=["Jardins"]),
        status=AdCampaignStatus.REJECTED,
        started_days_ago=None,
        objective=AdObjective.CLICKS,
        creative=dict(
            title="Frutas e verduras direto do produtor, com entrega no mesmo dia",
            content="Assinatura semanal de horta orgânica. Peça já a sua cesta.",
            image_url="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800",
            cta_label="Pedir cesta",
            target_url="https://mercadoorganicojardins.com.br",
            latitude=-23.5680,
            longitude=-46.6650,
        ),
    ),
    dict(
        advertiser_name="SuperApp Delivery",
        advertiser_email=f"parcerias@superapp{SEED_EMAIL_DOMAIN}",
        advertiser_phone="11 98000-0001",
        plan_slug="empresa-autoridade",
        formats=[AdFormat.POST, AdFormat.CONVERSATION, AdFormat.NOTIFICATION, AdFormat.SEARCH_POSTER],
        price_cents=129_990,
        duration_days=60,
        targeting=_targeting(citywide=True),
        status=AdCampaignStatus.ACTIVE,
        started_days_ago=15,
        objective=AdObjective.CLICKS,
        creative=dict(
            title="Peça no SuperApp e ganhe frete grátis na primeira compra",
            content="Restaurantes, mercado e farmácia — tudo em um só app, com entrega rápida no seu bairro.",
            image_url=None,
            video_url="https://www.w3schools.com/html/mov_bbb.mp4",
            cta_label="Baixar app",
            target_url="https://superapp.com.br/baixar",
            latitude=None,
            longitude=None,
        ),
    ),
]


def seed_campaigns():
    db = SessionLocal()
    try:
        existing = [
            c for c in ad_dao.list_campaigns(db) if c.advertiser_email.endswith(SEED_EMAIL_DOMAIN)
        ]
        if existing:
            print(f"• {len(existing)} campanhas de exemplo já existem, pulando.")
            return

        for data in CAMPAIGNS:
            plan = ad_dao.get_plan_by_slug(db, data["plan_slug"]) if data["plan_slug"] else None

            if data["started_days_ago"] is not None:
                starts_at = now - timedelta(days=data["started_days_ago"])
                ends_at = starts_at + timedelta(days=data["duration_days"])
            else:
                starts_at = None
                ends_at = None

            creative = data["creative"]
            campaign = ad_dao.create_campaign(
                db,
                creatives=[
                    dict(
                        format=None,
                        title=creative["title"],
                        content=creative["content"],
                        image_url=creative["image_url"],
                        video_url=creative.get("video_url"),
                        cta_label=creative["cta_label"],
                        target_url=creative["target_url"],
                        latitude=creative["latitude"],
                        longitude=creative["longitude"],
                    )
                ],
                plan_id=plan.id if plan else None,
                status=data["status"],
                advertiser_name=data["advertiser_name"],
                advertiser_email=data["advertiser_email"],
                advertiser_phone=data["advertiser_phone"],
                formats=data["formats"],
                price_cents=data["price_cents"],
                currency="BRL",
                targeting=data["targeting"],
                duration_days=data["duration_days"],
                objective=data["objective"],
                priority=3,
                rotation_weight=1.0,
                schedule=default_schedule(),
                starts_at=starts_at,
                ends_at=ends_at,
                paid_at=starts_at if data["status"] != AdCampaignStatus.PENDING_PAYMENT else None,
                payment_provider=PaymentProvider.ASAAS if starts_at else None,
                payment_reference=f"seed_{data['advertiser_email']}" if starts_at else None,
            )
            print(f"✅ campanha '{campaign.advertiser_name}' criada ({campaign.status}).")
    finally:
        db.close()


if __name__ == "__main__":
    seed_campaigns()
