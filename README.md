# MS OTP Automator

Chrome extension that automatically fills Microsoft MFA TOTP codes using `oathtool`.

When you hit a Microsoft Authenticator code prompt during login, the extension detects the input field, runs your configured `oathtool` command via a local Python script, fills the code, and clicks verify.

## Prerequisites

- Google Chrome or Chromium
- Python 3
- `oathtool` — install with:
  ```
  sudo apt install oathtool        # Debian/Ubuntu
  sudo pacman -S oath-toolkit      # Arch
  brew install oath-toolkit         # macOS
  ```

## Setup

### 1. Load the extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked** and select the `extension/` directory
4. Copy the **extension ID** shown on the card

### 2. Install the native messaging host

```bash
./install.sh <YOUR_EXTENSION_ID>
```

This registers the Python script so Chrome can communicate with it. If you skip the extension ID argument, you'll need to re-run the command once you have it.

### 3. Configure your oathtool command

1. Click the extension icon in the Chrome toolbar
2. Enter your oathtool command, e.g.:
   ```
   oathtool --totp -b JBSWY3DPEHPK3PXP
   ```
3. Click **Save**
4. Click **Test** to verify it returns a 6-digit code

## How it works

- A content script runs on `login.microsoftonline.com` and watches for the TOTP input field (`#idTxtBx_SAOTCC_OTC`) using a MutationObserver
- When detected, it asks the background service worker for an OTP
- The service worker retrieves your saved command from `chrome.storage.local` and sends it to the native messaging host
- The Python host (`ms_otp_host.py`) executes the command and returns the output
- The content script fills the input, fires input/change events, and clicks the verify button after a short delay

For **number matching** prompts (where you approve a number on your phone), the extension displays the number in an overlay — these can't be automated since they require action on the phone.

The **"Protect your account"** MFA registration prompt is automatically skipped (clicks "Skip for now"). This can be disabled in the extension popup.

## File structure

```
extension/
  manifest.json     # Chrome extension manifest (MV3)
  background.js     # Service worker — native messaging bridge
  content.js        # Detects MS auth pages, fills OTP codes
  popup.html        # Config UI
  popup.js          # Config UI logic
  popup.css         # Config UI styles
native_host/
  ms_otp_host.py    # Python native messaging host
  com.ms_otp_automator.json  # Host manifest template
install.sh          # Installs the native messaging host
```

## Troubleshooting

**"Failed to connect to native host"** — Re-run `./install.sh` with the correct extension ID. Make sure `ms_otp_host.py` is executable.

**"oathtool not found"** — Install `oathtool` (see Prerequisites).

**Code fills but verify doesn't click** — The page structure may have changed. Check that the verify button ID is still `#idSubmit_SAOTCC_Continue` in the page source.

**Extension doesn't trigger** — Make sure the content script is active on the page (check `chrome://extensions` for errors). The MFA page must be on `login.microsoftonline.com`.
