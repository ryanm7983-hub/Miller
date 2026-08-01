#!/usr/bin/env bash
# Package the web export for itch.io.
#
#   tools/package-itch.sh            # uses `godot` from PATH
#   GODOT=/path/to/godot tools/package-itch.sh
#
# itch.io requires index.html at the ZIP ROOT — not inside a folder. It also
# does not send Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy
# headers, so a build that needs SharedArrayBuffer will not start there. This
# project's Web preset has thread support disabled for exactly that reason, and
# the check below fails loudly if that ever changes.
set -euo pipefail

GODOT="${GODOT:-godot}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/build/itch"
ZIP="$ROOT/build/the-black-pine-itch.zip"

rm -rf "$OUT" "$ZIP"
mkdir -p "$OUT" "$ROOT/build/web"

"$GODOT" --headless --path "$ROOT" --export-release "Web" "$ROOT/build/web/index.html"
"$ROOT/tools/stamp-build.sh" "$ROOT/build/web/index.html"

cp "$ROOT"/build/web/index.html \
   "$ROOT"/build/web/index.js \
   "$ROOT"/build/web/index.wasm \
   "$ROOT"/build/web/index.pck \
   "$ROOT"/build/web/index.audio.worklet.js \
   "$ROOT"/build/web/index.audio.position.worklet.js \
   "$ROOT"/build/web/index.png \
   "$ROOT"/build/web/index.icon.png \
   "$ROOT"/build/web/index.apple-touch-icon.png \
   "$OUT/"

# For whoever downloads the zip and does the natural thing with it. itch.io
# ignores both files; a person opening the folder does not.
cp "$ROOT/tools/itch-readme.txt" "$OUT/READ-ME-FIRST.txt"
cp "$ROOT/tools/play-windows.bat" "$OUT/play-windows.bat"

if ! grep -q 'GODOT_THREADS_ENABLED = false' "$OUT/index.html"; then
  echo "ERROR: this build wants threads, so it needs COOP/COEP headers that" >&2
  echo "       itch.io does not set. Turn thread support off in the Web preset." >&2
  exit 1
fi

( cd "$OUT" && zip -q -r "$ZIP" . )
echo "wrote $ZIP ($(du -h "$ZIP" | cut -f1))"
echo
echo "Upload it at itch.io -> Create new project, then set:"
echo "  Kind of project      HTML"
echo "  This file will be    played in the browser"
echo "  Viewport             1280 x 720"
echo "  Fullscreen button    enabled"
echo "  Mobile friendly      enabled"
