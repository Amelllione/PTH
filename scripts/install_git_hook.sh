#!/bin/sh
# Ставит post-commit хук: после каждого коммита гоняет тесты из pth-tests.json и пишет результат в PTH.
# Хук не блокирует коммит. Настройки — в ~/.config/pth/ci.env (вне репозитория):
#   PTH_URL=http://127.0.0.1:8000
#   PTH_TOKEN=<ключ CI с правом записи в проект>
#   PTH_PYTHON=/путь/к/server/.venv/bin/python
set -e
ROOT=$(git rev-parse --show-toplevel)
HOOK="$ROOT/.git/hooks/post-commit"
cat > "$HOOK" <<'HOOK_EOF'
#!/bin/sh
# PTH: проверка тестов на каждом коммите (не блокирует коммит)
ROOT=$(git rev-parse --show-toplevel)
ENV=${PTH_ENV:-$HOME/.config/pth/ci.env}
[ -f "$ENV" ] || { echo "PTH: нет $ENV, тесты не запущены" >&2; exit 0; }
. "$ENV"
SHA=$(git rev-parse HEAD)
( "$PTH_PYTHON" "$ROOT/sdk/pth_ci.py" --commit "$SHA" >> "$ROOT/.git/pth-ci.log" 2>&1 ) &
exit 0
HOOK_EOF
chmod +x "$HOOK"
echo "установлен $HOOK"
