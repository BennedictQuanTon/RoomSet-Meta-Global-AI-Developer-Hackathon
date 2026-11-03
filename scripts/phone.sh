#!/usr/bin/env bash
# Runs Roomset for testing on a phone: production build, API on :8000, and an ngrok link.
# Run it again after changing code; it stops the previous run first. Stop with scripts/stop.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN="$ROOT/.run"
PORT=8000
WAIT_S=40

cd "$ROOT"
mkdir -p "$RUN"

step() { printf '\033[2m›\033[0m %s\n' "$*"; }
fail() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }
listening() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

command -v ngrok >/dev/null || fail "ngrok is not installed. Run: brew install ngrok, then ngrok config add-authtoken <your token>"
[ -x backend/.venv/bin/uvicorn ] || fail "Backend is not set up. Run: make setup"
[ -d frontend/node_modules ] || fail "Frontend is not set up. Run: make setup"
[ -f .env ] || step "No .env file: the app runs, but AI features stay off (cp .env.example .env)"

# A previous run of this project is stopped first, so the link always serves the latest code.
"$ROOT/scripts/stop.sh" --quiet

listening "$PORT" && fail "Port $PORT is used by another program. Free it, or close that program, then try again."
curl -s -m 2 http://127.0.0.1:4040/api/tunnels >/dev/null 2>&1 \
  && fail "Another ngrok is already running on this Mac (free accounts allow one). Close it, then try again."

step "Building the app"
(cd frontend && npm run build >"$RUN/build.log" 2>&1) || fail "The build failed. See .run/build.log"

step "Preparing the database"
(cd backend && .venv/bin/alembic upgrade head >"$RUN/migrate.log" 2>&1) || fail "Migrations failed. See .run/migrate.log"

step "Starting the server on port $PORT"
# Fully detached (exec, no shared output), so this script can finish while the server keeps running.
nohup bash -c 'cd "$1" && exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$2"' _ "$ROOT/backend" "$PORT" \
  >"$RUN/backend.log" 2>&1 </dev/null &
echo $! >"$RUN/backend.pid"
for _ in $(seq 1 $((WAIT_S * 2))); do
  curl -s -m 2 "http://127.0.0.1:$PORT/readyz" | grep -q '"database":"ok"' && break
  sleep 0.5
done
curl -s -m 2 "http://127.0.0.1:$PORT/readyz" | grep -q '"database":"ok"' || fail "The server did not start. See .run/backend.log"

step "Opening the ngrok tunnel"
nohup ngrok http "$PORT" --log stdout --log-format logfmt >"$RUN/ngrok.log" 2>&1 </dev/null &
echo $! >"$RUN/ngrok.pid"
URL=""
for _ in $(seq 1 $((WAIT_S * 2))); do
  URL="$(curl -s -m 2 http://127.0.0.1:4040/api/tunnels 2>/dev/null \
    | python3 -c 'import json,sys
try:
    print(next(t["public_url"] for t in json.load(sys.stdin)["tunnels"] if t["public_url"].startswith("https")))
except Exception:
    pass' || true)"
  [ -n "$URL" ] && break
  grep -qE 'lvl=(eror|crit)' "$RUN/ngrok.log" 2>/dev/null && break
  sleep 0.5
done
[ -n "$URL" ] || fail "ngrok did not give a link. See .run/ngrok.log (is your authtoken set?)"
echo "$URL" >"$RUN/url.txt"

CAPS="$(curl -s -m 5 "http://127.0.0.1:$PORT/api/capabilities")"
on() { echo "$CAPS" | grep -q "\"$1\":true" && echo "on" || echo "off"; }
LEFT="$(cd backend && .venv/bin/python -m app.core.budget 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print("$%.2f of $%.0f" % (d["left_usd"], d["limit_usd"]))' || echo "unknown")"

printf '\n\033[1mRoomset is live\033[0m\n\n'
printf '  Open on your phone   \033[1;32m%s/start\033[0m\n' "$URL"
printf '  In your room (AR)    %s/ar\n' "$URL"
printf '  Sample apartment     %s/studio\n\n' "$URL"
printf '  Voice assistant %s · AI reading %s · Style previews %s · AI budget left %s\n' "$(on assistant)" "$(on product_ai)" "$(on style_render)" "$LEFT"
printf '  Logs in .run/ · Stop everything with: scripts/stop.sh\n\n'
if command -v qrencode >/dev/null; then qrencode -t ANSIUTF8 "$URL/start"; fi
printf 'The first visit shows an ngrok notice: tap "Visit Site". After changing code, run this script again.\n'
