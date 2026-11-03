#!/bin/sh
# Starts WCA Stage from this folder. All data stays in data/ and reports/.
# Run with: sh start.sh

cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"
URL="http://localhost:${PORT:-5173}"

# Bundled Node. USB sticks (FAT32/exFAT) drop the executable flag, so copy it to /tmp when needed.
NODE="$DIR/node/linux/bin/node"
if [ -f "$NODE" ] && [ ! -x "$NODE" ]; then
  cp "$NODE" "${TMPDIR:-/tmp}/wca-stage-node" && chmod +x "${TMPDIR:-/tmp}/wca-stage-node"
  NODE="${TMPDIR:-/tmp}/wca-stage-node"
fi
if [ ! -x "$NODE" ]; then
  NODE="$(command -v node || command -v nodejs)"
fi
if [ -z "$NODE" ]; then
  echo "Node.js not found. Install it with: sudo apt install nodejs"
  exit 1
fi

"$NODE" "$DIR/server/server.mjs" &
SERVER_PID=$!
sleep 1

for BROWSER in chromium chromium-browser google-chrome google-chrome-stable microsoft-edge; do
  if command -v "$BROWSER" >/dev/null 2>&1; then
    "$BROWSER" --user-data-dir="$DIR/data/browser-linux" --app="$URL" --no-first-run
    kill "$SERVER_PID" 2>/dev/null
    exit 0
  fi
done

# No Chromium-based browser: open the default browser and keep the server running.
xdg-open "$URL" >/dev/null 2>&1 || echo "Open $URL in your browser."
echo "Press Ctrl+C to stop WCA Stage."
wait "$SERVER_PID"
