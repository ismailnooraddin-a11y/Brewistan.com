#!/usr/bin/env bash
# Generate missing platform scaffolding in isolation; never overwrite app sources.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
flutter create --org com.brewistan --project-name brewistan --platforms android,ios "$TMP/scaffold"
python3 "$ROOT/scripts/merge-mobile-platforms.py" "$TMP/scaffold" "$ROOT/apps/mobile"
cd "$ROOT/apps/mobile"
flutter pub get
echo "Mobile platforms ready. Release signing is configured separately."
