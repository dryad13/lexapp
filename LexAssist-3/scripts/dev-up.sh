#!/usr/bin/env bash
# Start LexAssist-3 ONLY (artifacts/api-server + artifacts/lexassist).
# Does not touch the parent LexApp monorepo apps.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:${PATH:-}"
export NODE_ENV=development
: "${DATABASE_URL:=postgresql://aaz@127.0.0.1:5432/lexassist_test}"
: "${ENCRYPTION_KEY:=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
: "${AUTH_PASSWORD:=HU51BAN}"
export DATABASE_URL ENCRYPTION_KEY AUTH_PASSWORD

RUN_DIR="${TMPDIR:-/tmp}/lexassist3-run"
mkdir -p "$RUN_DIR"

API_BIN="$ROOT/artifacts/api-server/node_modules/.bin/tsx"
WEB_BIN="$ROOT/artifacts/lexassist/node_modules/.bin/vite"

if [[ ! -x "$API_BIN" ]]; then
  echo "Missing $API_BIN — run pnpm install inside LexAssist-3 first"
  exit 1
fi
if [[ ! -x "$WEB_BIN" ]]; then
  echo "Missing $WEB_BIN — run pnpm install inside LexAssist-3 first"
  exit 1
fi

if lsof -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "API already on :8080"
else
  nohup env PORT=8080 DATABASE_URL="$DATABASE_URL" ENCRYPTION_KEY="$ENCRYPTION_KEY" AUTH_PASSWORD="$AUTH_PASSWORD" NODE_ENV=development \
    "$API_BIN" --tsconfig "$ROOT/artifacts/api-server/tsconfig.json" "$ROOT/artifacts/api-server/src/lexassist/index.ts" \
    >"$RUN_DIR/api.log" 2>&1 &
  echo $! >"$RUN_DIR/api.pid"
  echo "Started LexAssist-3 API pid $(cat "$RUN_DIR/api.pid")"
fi

if lsof -iTCP:21561 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "WEB already on :21561"
else
  nohup env PORT=21561 NODE_ENV=development \
    "$WEB_BIN" --config "$ROOT/artifacts/lexassist/vite.config.ts" --host 0.0.0.0 \
    >"$RUN_DIR/web.log" 2>&1 &
  echo $! >"$RUN_DIR/web.pid"
  echo "Started LexAssist-3 WEB pid $(cat "$RUN_DIR/web.pid")"
fi

for i in $(seq 1 60); do
  curl -sf -m 2 "http://127.0.0.1:8080/api/healthz" >/dev/null 2>&1 && break
  sleep 0.3
done
for i in $(seq 1 60); do
  curl -sf -m 2 -o /dev/null "http://127.0.0.1:21561/" >/dev/null 2>&1 && break
  sleep 0.3
done

curl -sf -m 3 "http://127.0.0.1:8080/api/healthz" >/dev/null && echo "API OK" || { echo "API FAILED"; tail -40 "$RUN_DIR/api.log"; exit 1; }
curl -sf -m 3 -o /dev/null "http://127.0.0.1:21561/" && echo "WEB OK" || { echo "WEB FAILED"; tail -40 "$RUN_DIR/web.log"; exit 1; }
curl -sf -m 3 -o /dev/null "http://127.0.0.1:21561/api/healthz" && echo "Proxy OK" || echo "Proxy WARN"

echo "LexAssist-3 root: $ROOT"
echo "Open: http://127.0.0.1:21561/login"
echo "Login: admin / admin12"
