"""Integração com o gateway de pagamento, isolada atrás de duas funções.

Implementação inicial: Stripe Checkout. Trocar de provedor (ex.: Mercado
Pago/Pagar.me para PIX nativo) significa reescrever só este arquivo — nada
em app/services/ad.py depende de detalhes do Stripe.
"""

import stripe

from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


def create_checkout_session(
    campaign_id: int, access_token: str, title: str, price_cents: int, currency: str
) -> str:
    session = stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": currency.lower(),
                    "unit_amount": price_cents,
                    "product_data": {"name": f"Anúncio Daqui — {title}"},
                },
                "quantity": 1,
            }
        ],
        success_url=f"{settings.STRIPE_SUCCESS_URL}?token={access_token}",
        cancel_url=settings.STRIPE_CANCEL_URL,
        metadata={"campaign_id": str(campaign_id)},
    )
    return session.url


def verify_webhook(payload: bytes, signature: str) -> stripe.Event:
    return stripe.Webhook.construct_event(
        payload, signature, settings.STRIPE_WEBHOOK_SECRET
    )
