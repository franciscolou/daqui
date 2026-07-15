"""Popula campanhas de exemplo pro usuário de teste do Daqui
(francisco@daqui.com, ver CLAUDE.md) — pra ter dado real ao testar "Meus
anúncios" na sidebar do app (LeftSidebar.tsx) e o painel comparativo em
`/anunciar/painel`, sem precisar criar campanhas na mão a cada setup.
Idempotente: pula se esse e-mail já tiver alguma campanha.
Execute: python -m app.seed_own_campaigns
"""

from datetime import datetime, timedelta, timezone

from app.daos import ad as ad_dao
from app.database import SessionLocal, create_tables
from app.models.ad import STATUS_ACTIVE, STATUS_PAUSED, default_schedule, default_targeting

OWNER_EMAIL = "francisco@daqui.com"

now = datetime.now(timezone.utc)


def _targeting(*, neighborhoods=None, citywide=False) -> dict:
    t = default_targeting()
    t["neighborhoods"] = neighborhoods or []
    t["citywide"] = citywide
    return t


CAMPAIGNS = [
    dict(
        advertiser_name="Francisco — Aulas de Violão",
        formats=["post"],
        price_cents=2_990,
        duration_days=14,
        targeting=_targeting(neighborhoods=["Leme"]),
        status=STATUS_ACTIVE,
        started_days_ago=6,
        objective="whatsapp_opens",
        creative=dict(
            title="Aulas de violão particulares no Leme",
            content="Do zero ao primeiro show: aulas presenciais, no seu ritmo. Primeira aula é cortesia.",
            image_url="https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800",
            cta_label="Chamar no WhatsApp",
            target_url="https://wa.me/5521999990000",
            latitude=-22.9641279,
            longitude=-43.1731249,
        ),
    ),
    dict(
        advertiser_name="Francisco — Jardinagem",
        formats=["post", "notification"],
        price_cents=5_990,
        duration_days=21,
        targeting=_targeting(neighborhoods=["Leme", "Copacabana"]),
        status=STATUS_PAUSED,
        started_days_ago=20,
        objective="clicks",
        creative=dict(
            title="Manutenção de jardim e vasos — orçamento sem compromisso",
            content="Poda, adubação e paisagismo simples para apartamentos e casas com quintal.",
            image_url="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800",
            cta_label="Pedir orçamento",
            target_url="https://wa.me/5521999990000",
            latitude=None,
            longitude=None,
        ),
    ),
]


def seed_own_campaigns():
    create_tables()
    db = SessionLocal()
    try:
        existing = ad_dao.list_campaigns_by_email(db, OWNER_EMAIL)
        if existing:
            print(f"• {len(existing)} campanhas de {OWNER_EMAIL} já existem, pulando.")
            return

        for data in CAMPAIGNS:
            starts_at = now - timedelta(days=data["started_days_ago"])
            ends_at = starts_at + timedelta(days=data["duration_days"])
            creative = data["creative"]
            campaign = ad_dao.create_campaign(
                db,
                creatives=[
                    dict(
                        format=None,
                        title=creative["title"],
                        content=creative["content"],
                        image_url=creative["image_url"],
                        video_url=None,
                        cta_label=creative["cta_label"],
                        target_url=creative["target_url"],
                        latitude=creative["latitude"],
                        longitude=creative["longitude"],
                        weight=1,
                        is_active=True,
                    )
                ],
                plan_id=None,
                status=data["status"],
                advertiser_name=data["advertiser_name"],
                advertiser_email=OWNER_EMAIL,
                advertiser_phone="21 99999-0000",
                formats=data["formats"],
                price_cents=data["price_cents"],
                currency="BRL",
                targeting=data["targeting"],
                duration_days=data["duration_days"],
                objective=data["objective"],
                priority=3,
                rotation_weight=1.0,
                pacing="asap",
                schedule=default_schedule(),
                starts_at=starts_at,
                ends_at=ends_at,
                paid_at=starts_at,
                payment_provider="manual",
                payment_reference=f"seed_own_{data['advertiser_name']}",
            )
            print(f"✅ campanha '{campaign.advertiser_name}' criada ({campaign.status}).")
    finally:
        db.close()


if __name__ == "__main__":
    seed_own_campaigns()
