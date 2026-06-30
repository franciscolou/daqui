#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Encerrando..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "▶ Backend  → http://localhost:8000"
cd "$ROOT/backend"
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "▶ Frontend → http://localhost:8081"
cd "$ROOT/frontend"
npx expo start --web &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
