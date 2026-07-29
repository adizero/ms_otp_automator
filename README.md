# MS OTP Automator

Browser extension that automatically fills Microsoft MFA TOTP codes using `oathtool`. Supports Chrome/Chromium and Firefox 128+.

When you hit a Microsoft Authenticator code prompt during login, the extension detects the input field, runs your configured `oathtool` command via a local Python script, fills the code, and clicks verify.

## Prerequisites

- Google Chrome / Chromium, or Firefox 128+
- Python 3
- `oathtool` — *optional*. For a plain `oathtool --totp` command the native host computes the
  code itself using the Python standard library, so the binary is only needed if you use options
  beyond `-b/--base32`, `--totp[=ALG]`, `-d/--digits` and `-s/--time-step-size`. To install it:
  ```
  sudo apt install oathtool        # Debian/Ubuntu
  sudo pacman -S oath-toolkit      # Arch
  brew install oath-toolkit         # macOS
  ```

## Setup

### 1. Load the extension

#### Chrome / Chromium

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked** and select the `extension/` directory
4. Copy the **extension ID** shown on the card

#### Firefox

`extension-firefox/` shares all code with `extension/` via symlinks; only the manifest differs (Firefox needs `background.scripts`, Chrome needs `background.service_worker`). The extension ID is fixed by `browser_specific_settings.gecko.id` in the manifest, so it stays `ms-otp-automator@local` across reloads and signed builds.

Pick one of the following:

**a) Temporary (gone after Firefox restarts)** — quickest for testing.

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** and pick any file inside `extension-firefox/` (e.g. `manifest.json`)

**b) Permanent on Developer Edition / Nightly / Unbranded** — no AMO account needed.

1. In `about:config`, set `xpinstall.signatures.required` to `false`
2. Build the XPI:
   ```bash
   ./build-xpi.sh
   ```
3. Install via `about:addons` → gear icon → **Install Add-on From File…** → pick the generated `ms-otp-automator-firefox-*.xpi`

**c) Permanent on regular Firefox release** — requires Mozilla-signed XPI.

1. Get an AMO API key/secret at https://addons.mozilla.org/developers/addon/api/key/
2. Sign with [`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/):
   ```bash
   web-ext sign --channel=unlisted \
     --api-key=$AMO_JWT_ISSUER --api-secret=$AMO_JWT_SECRET \
     --source-dir=extension-firefox
   ```
3. Install the signed XPI from `web-ext-artifacts/` via `about:addons` → gear icon → **Install Add-on From File…**

### 2. Install the native messaging host

#### Chrome / Chromium

```bash
./install.sh <YOUR_EXTENSION_ID>
```

This registers the Python script so Chrome can communicate with it. If you skip the extension ID argument, you'll need to re-run the command once you have it.

#### Firefox

```bash
./install.sh --firefox
```

The Firefox add-on ID defaults to the one declared in the manifest, so no argument is needed.

### 3. Get your TOTP secret key from Microsoft

1. Go to [Security info](https://mysignins.microsoft.com/security-info) and sign in
2. Click **Add sign-in method**
3. Select **Microsoft Authenticator**
4. Click **Set up a different authenticator app** → Next
5. On the QR code page, click **Can't scan the QR code**
6. Copy the **Secret key** (manually or using the "Copy key" button)

### 4. Configure your oathtool command

1. Click the extension icon in the browser toolbar
2. Enter your oathtool command, replacing `YOUR_SECRET` with the key from above:
   ```
   oathtool --totp -b YOUR_SECRET
   ```
3. Click **Test** to verify it returns a 6-digit code

## How it works

- A content script runs on `login.microsoftonline.com` and watches for the TOTP input field (`#idTxtBx_SAOTCC_OTC`) using a MutationObserver
- When detected, it asks the background service worker for an OTP
- The service worker retrieves your saved command from `chrome.storage.local` and sends it to the native messaging host
- The Python host (`ms_otp_host.py`) executes the command and returns the output
- The content script fills the input, fires input/change events, and clicks the verify button after a short delay

For **number matching** prompts (where you approve a number on your phone), the extension displays the number in an overlay — these can't be automated since they require action on the phone.

## Options

All options are configurable via the extension popup (click the extension icon in the toolbar).

| Option | Default | Description |
|--------|---------|-------------|
| **Enabled** | On | Global toggle — when off, the extension does nothing |
| **Auto-select account** | On | Automatically clicks an account tile on the "Pick an account" page |
| **Account name** | *(empty)* | Account to select, matched as regex first, then substring against the account email. When empty, the first account is selected |
| **Auto-fill password** | On | Fills the password and clicks "Sign in" on the password page |
| **Password** | *(empty)* | Password to fill. When empty, the extension attempts to click "Sign in" using whatever value is already prefilled in the field |
| **oathtool command** | *(required)* | Shell command to generate the TOTP code (e.g. `oathtool --totp -b YOUR_SECRET`) |
| **Skip MFA registration prompt** | On | Automatically clicks "Skip for now" on the "Protect your account" MFA registration page |

### Note on browser-prefilled passwords

When the password field is left empty in extension settings, the extension relies on values prefilled by the browser's built-in password manager or extensions like Bitwarden. Due to browser security restrictions, autofilled password values are not always accessible to extensions, which means the automatic "Sign in" click may fail and require a manual click. For reliable fully-automated login, **set the password directly in the extension configuration**.

## File structure

```
extension/                   # Load this dir in Chrome
  manifest.json              # MV3 manifest (background.service_worker)
  background.js              # Native messaging bridge
  content.js                 # Detects MS auth pages, fills OTP codes
  popup.html                 # Config UI
  popup.js                   # Config UI logic
  popup.css                  # Config UI styles
extension-firefox/           # Load this dir in Firefox
  manifest.json              # MV3 manifest (background.scripts + gecko id)
  background.js → ../extension/background.js   (symlink)
  content.js    → ../extension/content.js      (symlink)
  popup.html    → ../extension/popup.html      (symlink)
  popup.js      → ../extension/popup.js        (symlink)
  popup.css     → ../extension/popup.css       (symlink)
native_host/
  ms_otp_host.py             # Python native messaging host
  com.ms_otp_automator.json  # Host manifest template
install.sh                   # Installs the native messaging host (use --firefox for Firefox)
build-xpi.sh                 # Packages extension-firefox/ into a Firefox-installable XPI
```

## Troubleshooting

**"Failed to connect to native host"** — Re-run `./install.sh` with the correct extension ID. Make sure `ms_otp_host.py` is executable.

**"oathtool not found"** — Install `oathtool` (see Prerequisites).

**"Command failed (exit 127): oathtool: command not found"** — the native host could not run the
`oathtool` binary. Two causes, both handled automatically:

- The browser launched the host with a `PATH` that doesn't include `oathtool`. The host appends
  the standard bin directories (`/usr/local/bin`, `/usr/bin`, `/bin`, `~/.local/bin`, `~/bin`)
  and reports the `PATH` it used in the error.
- The browser is **sandboxed in a container** (Conty, Flatpak, Snap) whose filesystem has no
  `oathtool` at all. No `PATH` can fix this — the binary genuinely isn't there, and the host's
  `$HOME` is bind-mounted while the host's `/usr/bin` is not.

In both cases, when the command is a plain `oathtool --totp` invocation the host computes the
code itself (RFC 6238, Python stdlib only) instead of failing, so no external binary is needed.
If the command uses options the host doesn't recognise — `--window`, HOTP mode, an unsupported
digest — it reports the error rather than guessing at a code.

The **Test** button shows which path produced the code, so the fallback is never silent:

```
OTP: 471486
computed by: oathtool command

OTP: 471486
computed by: built-in TOTP — oathtool exited 127 (command not found)
```

If your `oathtool` lives somewhere unusual, you can also just give an absolute path in the
command field, e.g. `/opt/local/bin/oathtool --totp -b SECRET`.

**Code fills but verify doesn't click** — The page structure may have changed. Check that the verify button ID is still `#idSubmit_SAOTCC_Continue` in the page source.

**Extension doesn't trigger** — Make sure the content script is active on the page (check `chrome://extensions` or `about:debugging` for errors). The MFA page must be on `login.microsoftonline.com`.

## License

Copyright (c) 2026 Adrian Kocis. Licensed under the [MIT License](LICENSE).
