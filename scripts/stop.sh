#!/usr/bin/env bash
# Stops everything this project started: the phone run (scripts/phone.sh), make dev, and ngrok.
# Only processes running from this folder are touched. --quiet prints nothing when idle.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN="$ROOT/.run"
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1
stopped=()

cwd_of() { lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1; }
ours() { case "$(cwd_of "$1")" in "$ROOT"|"$ROOT"/*) return 0 ;; *) return 1 ;; esac; }

end() {
  local pid="$1" label="$2"
  kill -0 "$pid" 2>/dev/null || return 0
  kill "$pid" 2>/dev/null
  for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
  kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
  stopped+=("$label ($pid)")
}

# 1. What scripts/phone.sh recorded.
for name in ngrok backend; do
  file="$RUN/$name.pid"
  [ -f "$file" ] && end "$(cat "$file")" "$name"
  rm -f "$file"
done

# 2. Anything else from this folder: make dev's server and Vite, and their reloaders.
for pattern in "uvicorn app.main:app" "vite" "make -j2 backend frontend" "make dev" "scripts/phone.sh"; do
  for pid in $(pgrep -f "$pattern" 2>/dev/null); do
    [ "$pid" = "$$" ] && continue
    ours "$pid" && end "$pid" "$pattern"
  done
done
for port in 8000 5173; do
  for pid in $(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null); do
    ours "$pid" && end "$pid" "port $port"
  done
done

# 3. An ngrok tunnel to this project's ports, started from this folder.
for pid in $(pgrep -f "ngrok http (8000|5173)" 2>/dev/null); do
  ours "$pid" && end "$pid" "ngrok"
done
rm -f "$RUN/url.txt"

if [ ${#stopped[@]} -gt 0 ]; then
  [ $QUIET -eq 1 ] && printf '\033[2m›\033[0m Stopped the previous run\n' || printf 'Stopped: %s\n' "${stopped[*]}"
elif [ $QUIET -eq 0 ]; then
  echo "Nothing from Roomset was running."
fi

for port in 8000 5173; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && [ $QUIET -eq 0 ]; then
    echo "Note: port $port is still in use by a program outside this project; it was left alone."
  fi
done
exit 0
