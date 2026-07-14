#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Encerrando..."
  kill "$BACKEND_PID" "$FRONTEND_PID" "$MODERATOR_PID" "$ADS_BACKEND_PID" "$ADS_ADMIN_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" "$MODERATOR_PID" "$ADS_BACKEND_PID" "$ADS_ADMIN_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "▶ Backend    → http://localhost:8000"
cd "$ROOT/backend"
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Backend independente de anunciantes/anúncios (planos, campanhas, pagamento).
# Seed inicial: cd ads-backend && .venv/bin/python -m app.seed_admin && .venv/bin/python -m app.seed_plans
echo "▶ Ads backend → http://localhost:8001"
cd "$ROOT/ads-backend"
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8001 &
ADS_BACKEND_PID=$!

echo "▶ Frontend   → http://localhost:8081"
cd "$ROOT/frontend"
EXPO_PUBLIC_ADS_API_URL="http://localhost:8001/api/v1" npx expo start --web &
FRONTEND_PID=$!

# App de moderação (estático). Login: moderador@daqui.com / senha123
# (garanta a conta com: cd backend && .venv/bin/python -m app.seed_moderator)
echo "▶ Moderação  → http://localhost:8090"
cd "$ROOT/moderator"
python3 -m http.server 8090 --bind 0.0.0.0 &
MODERATOR_PID=$!

# Painel do time de anúncios (estático, login próprio do ads-backend).
# Login: ads@daqui.com / senha123
echo "▶ Anúncios   → http://localhost:8091"
cd "$ROOT/ads-admin"
python3 -m http.server 8091 --bind 0.0.0.0 &
ADS_ADMIN_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID" "$MODERATOR_PID" "$ADS_BACKEND_PID" "$ADS_ADMIN_PID"
