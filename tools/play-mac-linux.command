#!/usr/bin/env bash
# Double-click to play. Serves this folder over http and opens the browser.
#
# Opening index.html directly cannot work: browsers refuse `fetch` on a file://
# URL and the engine has to fetch a 37 MB runtime.
cd "$(dirname "$0")" || exit 1

PORT=8000
URL="http://localhost:$PORT/"

if command -v python3 >/dev/null 2>&1; then
	SERVER=(python3 -m http.server "$PORT" --bind 127.0.0.1)
elif command -v python >/dev/null 2>&1; then
	SERVER=(python -m SimpleHTTPServer "$PORT")
elif command -v npx >/dev/null 2>&1; then
	SERVER=(npx --yes http-server -p "$PORT" -c-1)
else
	echo
	echo "  No Python and no Node.js found, so this folder cannot be served."
	echo "  The game needs http, not a file:// path. Install Python and rerun."
	echo
	read -r -p "Press Enter to close"
	exit 1
fi

echo
echo "  THE BLACK PINE - serving locally"
echo
echo "  address  $URL"
echo
echo "  Leave this window open while you play. Ctrl-C to stop."
echo

(sleep 1; (open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || true)) &
exec "${SERVER[@]}"
