#!/usr/bin/env bash
# Stamp an exported index.html with a build identifier.
#
#   tools/stamp-build.sh build/web/index.html
#
# The shell prints this at the bottom of the loading screen. It exists because
# of a real dead end: a phone reported a failure that could not be reproduced
# anywhere, and there was no way to tell whether the device was running the
# build that contained the fix or a cached copy of the one that did not. A
# screenshot now answers that in one line.
set -euo pipefail

TARGET="${1:?usage: stamp-build.sh <exported index.html>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SHA="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo nogit)"
if ! git -C "$ROOT" diff --quiet HEAD 2>/dev/null; then
	SHA="$SHA+"
fi
STAMP="$(date -u +%Y-%m-%d)-$SHA"

if ! grep -q '__BUILD_ID__' "$TARGET"; then
	echo "ERROR: $TARGET has no __BUILD_ID__ placeholder — was it exported with" >&2
	echo "       export/black_pine_shell.html as the custom HTML shell?" >&2
	exit 1
fi

# `sed -i` with a literal, and the stamp is [0-9a-f+-] only, so no quoting trap.
sed -i "s/__BUILD_ID__/$STAMP/" "$TARGET"
echo "stamped $TARGET as $STAMP"
