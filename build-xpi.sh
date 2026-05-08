#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/extension-firefox"

if [ ! -f "$SRC/manifest.json" ]; then
    echo "Source not found: $SRC/manifest.json" >&2
    exit 1
fi

VERSION=$(python3 -c "import json; print(json.load(open('$SRC/manifest.json'))['version'])")
OUT="$SCRIPT_DIR/ms-otp-automator-firefox-$VERSION.xpi"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# XPIs are zips and cannot contain symlinks — dereference with cp -L.
cp -L -r "$SRC"/. "$TMPDIR"/

rm -f "$OUT"
( cd "$TMPDIR" && zip -qr "$OUT" . )

echo "Built: $OUT"
