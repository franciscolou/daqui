"""Validação e normalização de CPF/CNPJ.

Anunciante pode ser Pessoa Física (CPF) ou Pessoa Jurídica (CNPJ) — ver
`advertiser_type` em `models/ad.py`. Guardamos sempre só os dígitos
(`normalize`), mas validamos os dígitos verificadores aqui para não aceitar
um número obviamente inválido no checkout.
"""

import re

ADVERTISER_INDIVIDUAL = "individual"  # Pessoa Física — CPF
ADVERTISER_COMPANY = "company"  # Pessoa Jurídica — CNPJ
ADVERTISER_TYPES = (ADVERTISER_INDIVIDUAL, ADVERTISER_COMPANY)


def normalize(document: str) -> str:
    """Só os dígitos — é assim que persistimos (a UI reaplica a máscara)."""
    return re.sub(r"\D", "", document or "")


def _cpf_check_digit(digits: str, factor: int) -> int:
    total = sum(int(d) * (factor - i) for i, d in enumerate(digits))
    remainder = (total * 10) % 11
    return 0 if remainder == 10 else remainder


def is_valid_cpf(document: str) -> bool:
    cpf = normalize(document)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    if _cpf_check_digit(cpf[:9], 10) != int(cpf[9]):
        return False
    return _cpf_check_digit(cpf[:10], 11) == int(cpf[10])


def _cnpj_check_digit(digits: str, weights: list[int]) -> int:
    total = sum(int(d) * w for d, w in zip(digits, weights, strict=False))
    remainder = total % 11
    return 0 if remainder < 2 else 11 - remainder


def is_valid_cnpj(document: str) -> bool:
    cnpj = normalize(document)
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False
    first = _cnpj_check_digit(cnpj[:12], [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    if first != int(cnpj[12]):
        return False
    second = _cnpj_check_digit(cnpj[:13], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    return second == int(cnpj[13])


def validate_document(advertiser_type: str, document: str) -> str:
    """Valida o documento conforme o tipo e devolve a forma normalizada
    (só dígitos). Levanta `ValueError` — os schemas convertem em 422."""
    doc = normalize(document)
    if advertiser_type == ADVERTISER_INDIVIDUAL:
        if not is_valid_cpf(doc):
            raise ValueError("CPF inválido")
    elif advertiser_type == ADVERTISER_COMPANY:
        if not is_valid_cnpj(doc):
            raise ValueError("CNPJ inválido")
    else:
        raise ValueError(f"Tipo de anunciante inválido: {advertiser_type}")
    return doc
