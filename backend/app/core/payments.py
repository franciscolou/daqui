"""Integração com o gateway de pagamento, isolada atrás de duas funções.

Asaas Checkout (checkout hospedado, mesmo espírito do Stripe Checkout que
substituiu): PIX ou cartão — à vista ou parcelado, o próprio anunciante
escolhe na tela do Asaas. Trocar de provedor de novo significa reescrever só
este arquivo — nada em app/services/ad.py depende de detalhes do Asaas.

Docs: docs.asaas.com. Autenticação é sempre o header `access_token` (a chave
de API crua, sem prefixo "Bearer"); produção e sandbox são hosts diferentes,
não uma flag na mesma URL.
"""

import json
import logging

import httpx
from fastapi import HTTPException

from app.core.config import ADS_CHECKOUT_MAX_INSTALLMENTS, settings

logger = logging.getLogger(__name__)

ASAAS_BASE_URL = (
    "https://api.asaas.com/v3"
    if settings.ENVIRONMENT == "production"
    else "https://api-sandbox.asaas.com/v3"
)


def _headers() -> dict:
    return {"access_token": settings.ASAAS_API_KEY, "Content-Type": "application/json"}


def _asaas_error_detail(resp: httpx.Response) -> str:
    """Extrai a mensagem de erro real do corpo da resposta do Asaas
    (`{"errors": [{"description": "..."}]}`) — sem isso, um erro de conta (ex.:
    "Pix sem chave cadastrada") aparece só como "400" genérico, obrigando a
    reproduzir a chamada manualmente pra descobrir a causa."""
    try:
        errors = resp.json().get("errors") or []
    except ValueError:
        errors = []
    descriptions = [e["description"] for e in errors if e.get("description")]
    return "; ".join(descriptions) if descriptions else (resp.text or f"erro {resp.status_code}")


def create_checkout_session(
    campaign_id: int,
    access_token: str,
    title: str,
    price_cents: int,
    advertiser_name: str = "",
    advertiser_email: str = "",
    advertiser_phone: str = "",
    advertiser_document: str = "",
) -> str:
    """Cria um checkout hospedado no Asaas e devolve o link pra redirecionar o
    anunciante — PIX ou cartão (à vista ou parcelado em até
    ADS_CHECKOUT_MAX_INSTALLMENTS), a escolha fica pro próprio anunciante na
    tela do Asaas.

    `customerData` é opcional na API do Asaas: manda o que a campanha já tem
    (nome/e-mail/telefone/documento) só pra pré-preencher, mas nunca bloqueia
    o checkout por campo faltando — o que não vier, o próprio Asaas pergunta
    na hora (diferente da API de cobrança direta, que exige CPF/CNPJ antes).
    """
    customer_data = {
        k: v
        for k, v in {
            "name": advertiser_name,
            "email": advertiser_email,
            "phone": advertiser_phone,
            "cpfCnpj": advertiser_document,
        }.items()
        if v
    }

    payload = {
        "billingTypes": ["PIX", "CREDIT_CARD"],
        "chargeTypes": ["DETACHED", "INSTALLMENT"],
        "installment": {"maxInstallmentCount": ADS_CHECKOUT_MAX_INSTALLMENTS},
        "items": [
            {"name": f"Anúncio Daqui — {title}", "value": price_cents / 100, "quantity": 1}
        ],
        "callback": {
            "successUrl": f"{settings.ADS_CHECKOUT_SUCCESS_URL}?token={access_token}",
            "cancelUrl": settings.ADS_CHECKOUT_CANCEL_URL,
        },
        "externalReference": str(campaign_id),
    }
    if customer_data:
        payload["customerData"] = customer_data

    resp = httpx.post(f"{ASAAS_BASE_URL}/checkouts", json=payload, headers=_headers(), timeout=15)
    if resp.is_error:
        detail = _asaas_error_detail(resp)
        logger.error("Asaas rejeitou create_checkout_session (campanha %s): %s", campaign_id, detail)
        status = 502 if resp.is_server_error else 400
        # Detalhe cru do gateway só fora de produção (conveniência de debug
        # local) — em produção vazaria detalhe de implementação (qual gateway
        # usamos, validação interna dele) pro anunciante, sem ele poder fazer
        # nada a respeito mesmo sabendo a causa exata.
        message = detail if settings.ENVIRONMENT != "production" else "Não foi possível iniciar o pagamento agora. Tente novamente em instantes."
        raise HTTPException(status_code=status, detail=message)
    return resp.json()["link"]


def verify_webhook(payload: bytes, token: str) -> dict:
    """Confere o header `asaas-access-token` contra o valor configurado no
    dashboard do Asaas (ver ASAAS_WEBHOOK_TOKEN) e devolve o corpo já
    decodificado. Diferente do Stripe, não é assinatura criptográfica — é
    comparação direta de um segredo compartilhado que você mesmo escolhe.
    """
    if not settings.ASAAS_WEBHOOK_TOKEN or token != settings.ASAAS_WEBHOOK_TOKEN:
        raise HTTPException(status_code=401, detail="Token de webhook inválido")
    try:
        return json.loads(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Payload inválido") from e
