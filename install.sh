#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.ms_otp_automator"
HOST_PY="$SCRIPT_DIR/native_host/ms_otp_host.py"
FIREFOX_DEFAULT_ID="ms-otp-automator@local"

usage() {
    echo "Usage: $0 [--chrome|--firefox] [EXTENSION_ID]"
    echo ""
    echo "  --chrome    Install for Chrome/Chromium (default)"
    echo "  --firefox   Install for Firefox"
    echo ""
    echo "  EXTENSION_ID is the ID shown on the extension card."
    echo "  For Firefox it defaults to '$FIREFOX_DEFAULT_ID'"
    echo "  (matches browser_specific_settings.gecko.id in extension-firefox/manifest.json)."
    exit 1
}

BROWSER="chrome"
EXT_ID=""
while [ $# -gt 0 ]; do
    case "$1" in
        --chrome|--chromium) BROWSER="chrome" ;;
        --firefox) BROWSER="firefox" ;;
        -h|--help) usage ;;
        --*) echo "Unknown option: $1"; usage ;;
        *) EXT_ID="$1" ;;
    esac
    shift
done

# Make the Python script executable
chmod +x "$HOST_PY"

if [ "$BROWSER" = "firefox" ]; then
    TARGET_DIR="$HOME/.mozilla/native-messaging-hosts"
    EXT_ID="${EXT_ID:-$FIREFOX_DEFAULT_ID}"
    ALLOWED_KEY="allowed_extensions"
    ALLOWED_VALUE="\"$EXT_ID\""
else
    CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    CHROMIUM_DIR="$HOME/.config/chromium/NativeMessagingHosts"
    if [ -d "$HOME/.config/google-chrome" ]; then
        TARGET_DIR="$CHROME_DIR"
    elif [ -d "$HOME/.config/chromium" ]; then
        TARGET_DIR="$CHROMIUM_DIR"
    else
        echo "Neither Chrome nor Chromium config directory found."
        echo "Creating Chrome directory: $CHROME_DIR"
        TARGET_DIR="$CHROME_DIR"
    fi
    EXT_ID="${EXT_ID:-EXTENSION_ID_HERE}"
    ALLOWED_KEY="allowed_origins"
    ALLOWED_VALUE="\"chrome-extension://$EXT_ID/\""
fi

mkdir -p "$TARGET_DIR"

HOST_MANIFEST_DST="$TARGET_DIR/$HOST_NAME.json"

cat > "$HOST_MANIFEST_DST" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Native messaging host for MS OTP Automator",
  "path": "$HOST_PY",
  "type": "stdio",
  "$ALLOWED_KEY": [
    $ALLOWED_VALUE
  ]
}
EOF

echo "Native messaging host installed for $BROWSER:"
echo "  Manifest: $HOST_MANIFEST_DST"
echo "  Script:   $HOST_PY"
echo ""

if [ "$BROWSER" = "chrome" ] && [ "$EXT_ID" = "EXTENSION_ID_HERE" ]; then
    echo "IMPORTANT: You need to update the extension ID."
    echo "1. Load the extension in chrome://extensions (developer mode)"
    echo "2. Copy the extension ID"
    echo "3. Re-run: $0 <EXTENSION_ID>"
else
    echo "Extension ID set to: $EXT_ID"
    echo "Setup complete."
fi
