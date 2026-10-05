#!/usr/bin/env bash
# Поднимает API (FastAPI, порт 8000) и UI (Vite, порт 5173) для локальной разработки.
# Остановка: Ctrl+C. Требует server/.venv и ui/node_modules (см. README).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

(cd "$ROOT/server" && exec .venv/bin/python -m uvicorn pth.__main__:app --host 127.0.0.1 --port 8000 --reload) &
API_PID=$!
(cd "$ROOT/ui" && exec npx vite --host 127.0.0.1 --port 5173 --strictPort) &
UI_PID=$!

trap 'kill "$API_PID" "$UI_PID" 2>/dev/null' EXIT INT TERM
echo "API: http://127.0.0.1:8000/docs   UI: http://127.0.0.1:5173/"
wait
