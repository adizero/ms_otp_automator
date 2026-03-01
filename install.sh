#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.ms_otp_automator"
HOST_PY="$SCRIPT_DIR/native_host/ms_otp_host.py"
HOST_MANIFEST_SRC="$SCRIPT_DIR/native_host/$HOST_NAME.json"

# Make the Python script executable
chmod +x "$HOST_PY"

# Detect browser native messaging directory
CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
CHROMIUM_DIR="$HOME/.config/chromium/NativeMessagingHosts"

TARGET_DIR=""
if [ -d "$HOME/.config/google-chrome" ]; then
    TARGET_DIR="$CHROME_DIR"
elif [ -d "$HOME/.config/chromium" ]; then
    TARGET_DIR="$CHROMIUM_DIR"
else
    echo "Neither Chrome nor Chromium config directory found."
    echo "Creating Chrome directory: $CHROME_DIR"
    TARGET_DIR="$CHROME_DIR"
fi

mkdir -p "$TARGET_DIR"

# Generate the host manifest with the correct path
HOST_MANIFEST_DST="$TARGET_DIR/$HOST_NAME.json"

# Read extension ID from argument or use placeholder
EXT_ID="${1:-EXTENSION_ID_HERE}"

cat > "$HOST_MANIFEST_DST" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Native messaging host for MS OTP Automator",
  "path": "$HOST_PY",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXT_ID/"
  ]
}
EOF

echo "Native messaging host installed:"
echo "  Manifest: $HOST_MANIFEST_DST"
echo "  Script:   $HOST_PY"
echo ""

if [ "$EXT_ID" = "EXTENSION_ID_HERE" ]; then
    echo "IMPORTANT: You need to update the extension ID."
    echo "1. Load the extension in chrome://extensions (developer mode)"
    echo "2. Copy the extension ID"
    echo "3. Re-run: $0 <EXTENSION_ID>"
else
    echo "Extension ID set to: $EXT_ID"
    echo "Setup complete."
fi
