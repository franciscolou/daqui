"""Popula impressões/cliques (`AdEvent`) das campanhas do usuário de teste
(francisco@daqui.com, ver seed_ads_campaigns.py/seed_ads_own_campaigns.py) —
sem eventos, o dashboard "Meus anúncios" (`/advertise/dashboard`) fica com
KPIs, insights e gráficos todos zerados/vazios, mesmo tendo campanhas.
Só gera eventos pra campanhas que realmente "rodaram" (active/paused/expired);
propostas paradas em pending_payment/rejected/awaiting_content nunca foram
entregues, então continuam sem nenhum evento — mesmo critério que o backend
usa pra elegibilidade de entrega.
Idempotente: pula se já existir qualquer AdEvent para essas campanhas.
Execute: python -m app.seed_ads_events
"""
import random
from datetime import datetime, timedelta, timezone

from app.daos import ad as ad_dao
from app.database import SessionLocal
from app.models.ad import AdCampaignStatus, AdEvent, AdEventType

OWNER_EMAIL = "francisco@daqui.com"
# Janela de histórico gerada — ampla o bastante pra um gráfico "ao longo do
# tempo" ter forma, curta o bastante pra não gerar volume desnecessário.
EVENT_HISTORY_DAYS = 14
RUNNING_STATUSES = {AdCampaignStatus.ACTIVE, AdCampaignStatus.PAUSED, AdCampaignStatus.EXPIRED}

random.seed(42)  # reprodutível — reseed não deve mudar o "formato" dos gráficos a cada rodada


def seed_events():
    db = SessionLocal()
    try:
        campaigns = ad_dao.list_campaigns_by_email(db, OWNER_EMAIL)
        if not campaigns:
            print(f"⚠ Nenhuma campanha de {OWNER_EMAIL}. Rode os seeds de campanha antes.")
            return

        campaign_ids = [c.id for c in campaigns]
        already = (
            db.query(AdEvent).filter(AdEvent.campaign_id.in_(campaign_ids)).first()
        )
        if already:
            print("• Eventos de anúncio já existem pra essas campanhas, pulando.")
            return

        now = datetime.now(timezone.utc)
        events: list[AdEvent] = []

        for c in campaigns:
            if c.status not in RUNNING_STATUSES or not c.starts_at:
                continue

            window_end = min(c.ends_at or now, now)
            window_start = max(c.starts_at, window_end - timedelta(days=EVENT_HISTORY_DAYS))
            if window_start >= window_end:
                continue

            hoods = (c.targeting or {}).get("neighborhoods") or []
            # Reach maior pra campanhas mais caras — não é uma fórmula real de
            # precificação, só dá variedade proporcional entre os cards do grid.
            price_reais = c.price_cents / 100
            base_impressions = max(6, min(140, int(price_reais * random.uniform(1.0, 2.1))))
            ctr = random.uniform(0.015, 0.065)

            day = window_start.date()
            while day <= window_end.date():
                # Dia sem nenhum evento de vez em quando — realista, sem forçar
                # uma linha reta perfeita no gráfico.
                if random.random() < 0.92:
                    day_impressions = max(0, int(base_impressions * random.uniform(0.45, 1.35)))
                    day_clicks = min(
                        day_impressions,
                        round(day_impressions * ctr * random.uniform(0.5, 1.5)),
                    )
                    for _ in range(day_impressions):
                        events.append(_make_event(c, day, AdEventType.IMPRESSION, hoods))
                    for _ in range(day_clicks):
                        events.append(_make_event(c, day, AdEventType.CLICK, hoods))
                day += timedelta(days=1)

        db.bulk_save_objects(events)
        db.commit()
        print(f"✅ {len(events)} eventos de anúncio inseridos para {len(campaigns)} campanhas.")
    finally:
        db.close()


def _make_event(campaign, day, event_type: AdEventType, hoods: list[str]) -> AdEvent:
    occurred_at = datetime(
        day.year, day.month, day.day, tzinfo=timezone.utc
    ) + timedelta(seconds=random.randint(0, 86_399))
    return AdEvent(
        campaign_id=campaign.id,
        event_type=event_type,
        format=random.choice(campaign.formats),
        neighborhood=random.choice(hoods) if hoods else None,
        occurred_at=occurred_at,
    )


if __name__ == "__main__":
    seed_events()
