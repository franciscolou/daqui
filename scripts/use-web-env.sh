#!/usr/bin/env bash
# Volta o frontend pro default de dev web (localhost:8000/8001) removendo
# frontend/.env.local, se existir. Reinicie `expo start` (ou ./dev.sh) depois.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rm -f "$ROOT/frontend/.env.local"
echo "frontend/.env.local removido — voltando ao default localhost. Reinicie o expo."
