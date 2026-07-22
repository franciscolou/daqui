"""Envio de push notification via Expo Push Service, isolado atrás de uma
função — mesmo padrão de `core/email.py` (Resend) e `ads-backend/app/core/
payments.py` (Stripe).

Em `ENVIRONMENT=development`, não chama o Expo: loga no console, para dar pra
testar o fluxo de ponta a ponta sem precisar de dispositivo/projeto EAS reais.

Ao contrário do e-mail, uma falha aqui nunca propaga: push é best-effort e não
pode derrubar a ação (enviar mensagem, criar notificação) que o disparou.
"""

import httpx

from app.core.config import settings

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
# Limite de mensagens por request imposto pelo Expo Push Service.
_BATCH_SIZE = 100


def send_push(tokens: list[str], title: str, body: str, data: dict | None = None) -> None:
    if not tokens:
        return

    if settings.ENVIRONMENT == "development":
        print(f"\n[push:dev] para={tokens}\n[push:dev] título={title}\n[push:dev] corpo={body}\n")
        return

    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if settings.EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"

    for i in range(0, len(tokens), _BATCH_SIZE):
        batch = tokens[i : i + _BATCH_SIZE]
        messages = [
            {"to": token, "title": title, "body": body, "data": data or {}} for token in batch
        ]
        try:
            httpx.post(EXPO_PUSH_URL, headers=headers, json=messages, timeout=10)
        except httpx.HTTPError as exc:
            print(f"[push] falha ao enviar lote para o Expo: {exc}")
