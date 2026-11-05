#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for dir in server web; do
  if [ ! -d "$ROOT/$dir/node_modules" ]; then
    echo "Installing $dir dependencies..."
    (cd "$ROOT/$dir" && npm install)
  fi
done

ENV_FILE="$ROOT/server/.env"
if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT/server/.env.example" "$ENV_FILE"
  echo "Created server/.env. Set LOGIMU_API_KEY in it, then run this script again."
  exit 1
fi

if ! grep -Eq '^LOGIMU_API_KEY=.+' "$ENV_FILE" || grep -q 'your_logimu_api_key_here' "$ENV_FILE"; then
  echo "LOGIMU_API_KEY is not set in server/.env"
  exit 1
fi

cleanup() {
  trap - INT TERM EXIT
  kill 0 2>/dev/null || true
}
trap cleanup INT TERM EXIT

(cd "$ROOT/server" && npm run dev) &
(cd "$ROOT/web" && npm run dev) &

echo "API: http://localhost:3001   App: http://localhost:5173"
wait
