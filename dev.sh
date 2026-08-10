#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Encerrando..."
  kill "$BACKEND_PID" "$FRONTEND_PID" "$MODERATOR_PID" "$ADS_ADMIN_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" "$MODERATOR_PID" "$ADS_ADMIN_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

# Inclui o domínio de anúncios (planos, campanhas, pagamento — rotas /ads/*
# e /ads-admin/*). Seed inicial: cd backend && .venv/bin/python -m app.seed_ads_admin
# && .venv/bin/python -m app.seed_ads_plans
echo "▶ Backend    → http://localhost:8000"
cd "$ROOT/backend"
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "▶ Frontend   → http://localhost:8081"
cd "$ROOT/frontend"
# EXPO_PUBLIC_API_URL / EXPO_PUBLIC_ADS_API_URL não são setados aqui de propósito —
# lib/api.ts e lib/adsApi.ts já caem em localhost:8000 por padrão (ver CLAUDE.md).
npx expo start --web &
FRONTEND_PID=$!

# App de moderação (Vite + React). Login: moderador@daqui.com / senha123
# (garanta a conta com: cd backend && .venv/bin/python -m app.seed_moderator)
# Rode `npm install` na primeira vez.
echo "▶ Moderação  → http://localhost:8090"
cd "$ROOT/moderator"
npx vite --port 8090 &
MODERATOR_PID=$!

# Painel do time de anúncios (Vite + React, login próprio de AdAdmin, rotas
# /ads-admin/* do mesmo backend acima). Reaproveita os componentes de local
# do app Daqui via react-native-web — ver ads-admin/vite.config.ts.
# Login: ads@daqui.com / senha123
echo "▶ Anúncios   → http://localhost:8091"
cd "$ROOT/ads-admin"
npx vite --port 8091 &
ADS_ADMIN_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID" "$MODERATOR_PID" "$ADS_ADMIN_PID"
