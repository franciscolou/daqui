"""Extração leve de um nome de dispositivo legível a partir do User-Agent.

Não usa nenhuma lib externa (nenhuma está no requirements.txt) — cobre os casos
mais comuns (navegadores desktop/mobile e os clientes nativos do Expo) o
suficiente para exibir em "Configurações > Dispositivos conectados".
"""

_OS_PATTERNS: list[tuple[str, str]] = [
    ("iPhone", "iOS"),
    ("iPad", "iPadOS"),
    ("Android", "Android"),
    ("Mac OS X", "macOS"),
    ("Windows", "Windows"),
    ("CrOS", "ChromeOS"),
    ("Linux", "Linux"),
]

_BROWSER_PATTERNS: list[tuple[str, str]] = [
    ("Edg/", "Edge"),
    ("OPR/", "Opera"),
    ("Chrome/", "Chrome"),
    ("CriOS/", "Chrome"),
    ("FxiOS/", "Firefox"),
    ("Firefox/", "Firefox"),
    ("Safari/", "Safari"),
]

# Clientes nativos (Expo/React Native) não passam por um navegador.
_NATIVE_PATTERNS: list[tuple[str, str]] = [
    ("okhttp", "App Android"),
    ("Dalvik", "App Android"),
    ("CFNetwork", "App iOS"),
]


def parse_device_name(user_agent: str | None) -> str:
    ua = user_agent or ""

    os_name = next((label for token, label in _OS_PATTERNS if token in ua), None)

    for token, label in _NATIVE_PATTERNS:
        if token in ua:
            return label if not os_name else f"{label} ({os_name})"

    browser = next((label for token, label in _BROWSER_PATTERNS if token in ua), None)

    if browser and os_name:
        return f"{browser} · {os_name}"
    if browser:
        return browser
    if os_name:
        return os_name
    return "Dispositivo desconhecido"
