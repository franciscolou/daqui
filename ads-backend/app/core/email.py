"""Envio de e-mail transacional, isolado atrás de uma função — mesmo padrão de
`app/core/payments.py` para o Stripe, espelhando `backend/app/core/email.py`.
Implementação: Resend.

Em `ENVIRONMENT=development`, não chama o Resend: loga o e-mail (com o link/
código) no console, para dar pra testar o fluxo real de ponta a ponta sem
precisar de uma API key válida no dia a dia.
"""

import httpx

from app.core.config import settings

RESEND_API_URL = "https://api.resend.com/emails"


def send_email(to: str, subject: str, html: str) -> None:
    if settings.ENVIRONMENT == "development":
        print(f"\n[email:dev] para={to}\n[email:dev] assunto={subject}\n{html}\n")
        return

    response = httpx.post(
        RESEND_API_URL,
        headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
        json={"from": settings.EMAIL_FROM, "to": [to], "subject": subject, "html": html},
        timeout=10,
    )
    response.raise_for_status()
