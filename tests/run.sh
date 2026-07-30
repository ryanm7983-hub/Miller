#!/usr/bin/env bash
# Run the automated test suite headlessly.
#
#   tests/run.sh                 # uses `godot` from PATH
#   GODOT=/path/to/godot tests/run.sh
#
# The import pass is required whenever a script with a new `class_name` has
# been added: global class registration happens at import time, and a test that
# references an unregistered class fails to parse.
set -euo pipefail

GODOT="${GODOT:-godot}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$GODOT" --headless --path "$ROOT" --import >/dev/null 2>&1 || true
exec "$GODOT" --headless --path "$ROOT" res://scenes/test/test_runner.tscn
