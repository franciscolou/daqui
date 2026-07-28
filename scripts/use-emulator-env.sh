#!/usr/bin/env bash
# Aponta o frontend pro backend via 10.0.2.2 (emulador Android) copiando
# frontend/.env.emulator -> frontend/.env.local. Reinicie `expo start` (ou
# ./dev.sh) depois de rodar isso.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cp "$ROOT/frontend/.env.emulator" "$ROOT/frontend/.env.local"
echo "frontend/.env.local agora aponta pro emulador (10.0.2.2). Reinicie o expo."
