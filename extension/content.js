(function () {
  "use strict";

  const OTP_INPUT_ID = "idTxtBx_SAOTCC_OTC";
  const VERIFY_BUTTON_ID = "idSubmit_SAOTCC_Continue";
  const NUMBER_MATCH_ID = "idRichContext_DisplaySign";
  const SKIP_LINK_ID = "skipMfaRegistrationLink";
  const PASSWORD_INPUT_ID = "i0118";
  const SIGNIN_BUTTON_ID = "idSIButton9";
  const SUBMIT_DELAY_MS = 500;

  let otpHandled = false;
  let skipHandled = false;
  let accountPickerHandled = false;
  let passwordHandled = false;

  function fillOtpCode(code) {
    const input = document.getElementById(OTP_INPUT_ID);
    if (!input) return;

    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    ).set;
    nativeSetter.call(input, code);

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    setTimeout(() => {
      const btn = document.getElementById(VERIFY_BUTTON_ID);
      if (btn) btn.click();
    }, SUBMIT_DELAY_MS);
  }

  function showNumberMatchOverlay(number) {
    const existing = document.getElementById("ms-otp-automator-overlay");
    if (existing) return;

    const overlay = document.createElement("div");
    overlay.id = "ms-otp-automator-overlay";
    overlay.style.cssText =
      "position:fixed;top:20px;right:20px;z-index:999999;" +
      "background:#1a1a2e;color:#fff;padding:16px 24px;border-radius:8px;" +
      "font-size:28px;font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.3);" +
      "font-family:sans-serif;text-align:center;";
    overlay.innerHTML =
      '<div style="font-size:12px;margin-bottom:4px;color:#aaa;">Approve this number on your phone</div>' +
      '<div style="font-size:36px;">' + number + "</div>";
    document.body.appendChild(overlay);

    setTimeout(() => overlay.remove(), 30000);
  }

  function handleOtpInput() {
    if (otpHandled) return;
    otpHandled = true;

    chrome.runtime.sendMessage({ type: "GET_OTP" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("MS OTP Automator:", chrome.runtime.lastError.message);
        otpHandled = false;
        return;
      }
      if (response && response.otp) {
        fillOtpCode(response.otp);
      } else {
        console.error("MS OTP Automator: no OTP in response", response);
        otpHandled = false;
      }
    });
  }

  function handleNumberMatch(el) {
    const number = el.textContent.trim();
    if (number) showNumberMatchOverlay(number);
  }

  function handleSkipPrompt(link) {
    if (skipHandled) return;
    skipHandled = true;

    chrome.storage.local.get("skipMfaRegistration", (data) => {
      if (data.skipMfaRegistration === false) {
        skipHandled = false;
        return;
      }
      link.click();
    });
  }

  function clickSignIn() {
    if (passwordHandled) return;
    passwordHandled = true;

    // Content scripts run in an isolated world and cannot read
    // Chrome-autofilled input.value. Inject a script into the page's
    // main world to dispatch an input event; Knockout's textInput
    // handler runs in that world where the value IS accessible,
    // so it syncs the observable before we click Sign in.
    const s = document.createElement("script");
    s.textContent =
      "var e=document.getElementById('" + PASSWORD_INPUT_ID + "');" +
      "if(e){" +
      "var s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;" +
      "s.call(e,e.value);" +
      "e.dispatchEvent(new Event('input',{bubbles:true}));" +
      "e.dispatchEvent(new Event('change',{bubbles:true}))" +
      "}";
    document.documentElement.appendChild(s);
    s.remove();

    setTimeout(() => {
      const btn = document.getElementById(SIGNIN_BUTTON_ID);
      if (btn) btn.click();
    }, SUBMIT_DELAY_MS);
  }

  function isPasswordFilled(input) {
    if (input.value) return true;
    try {
      if (input.matches(":autofill, :-webkit-autofill")) return true;
    } catch (_) {}
    return false;
  }

  function handlePasswordEntry() {
    if (passwordHandled) return;

    chrome.storage.local.get(
      ["autoFillPassword", "autoFillPasswordValue"],
      (data) => {
        if (passwordHandled) return;
        if (data.autoFillPassword === false) return;

        const input = document.getElementById(PASSWORD_INPUT_ID);
        if (!input) return;

        const password = (data.autoFillPasswordValue || "").trim();
        if (password) {
          const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
          ).set;
          nativeSetter.call(input, password);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          clickSignIn();
          return;
        }

        if (isPasswordFilled(input)) {
          clickSignIn();
          return;
        }

        // Listen for password managers that fill the field asynchronously
        if (!input._msotpListener) {
          input._msotpListener = true;
          input.addEventListener("input", () => {
            if (input.value) clickSignIn();
          });
          input.addEventListener("change", () => {
            if (input.value) clickSignIn();
          });
        }
      }
    );
  }

  function handleAccountPicker() {
    if (accountPickerHandled) return;
    accountPickerHandled = true;

    chrome.storage.local.get(
      ["autoSelectAccount", "autoSelectAccountName"],
      (data) => {
        if (data.autoSelectAccount === false) {
          accountPickerHandled = false;
          return;
        }

        const tiles = document.querySelectorAll(
          '#tilesHolder .table[role="button"][data-test-id]' +
            ":not(#otherTile .table)"
        );
        if (tiles.length === 0) {
          accountPickerHandled = false;
          return;
        }

        const name = (data.autoSelectAccountName || "").trim();
        if (!name) {
          tiles[0].click();
          return;
        }

        let match = null;
        try {
          const re = new RegExp(name, "i");
          match = Array.from(tiles).find((t) =>
            re.test(t.getAttribute("data-test-id"))
          );
        } catch (_) {
          // invalid regex, fall through to substring
        }
        if (!match) {
          const lower = name.toLowerCase();
          match = Array.from(tiles).find((t) =>
            t.getAttribute("data-test-id").toLowerCase().includes(lower)
          );
        }
        if (match) {
          match.click();
        } else {
          accountPickerHandled = false;
        }
      }
    );
  }

  function checkPage() {
    const otpInput = document.getElementById(OTP_INPUT_ID);
    if (otpInput && otpInput.offsetParent !== null) {
      handleOtpInput();
      return;
    }

    const numberMatch = document.getElementById(NUMBER_MATCH_ID);
    if (numberMatch && numberMatch.offsetParent !== null) {
      handleNumberMatch(numberMatch);
      return;
    }

    const passwordInput = document.getElementById(PASSWORD_INPUT_ID);
    if (passwordInput && passwordInput.offsetParent !== null) {
      handlePasswordEntry();
      return;
    }

    const meta = document.querySelector('meta[name="PageID"]');
    if (meta && meta.content === "ConvergedSignIn") {
      const tilesHolder = document.getElementById("tilesHolder");
      if (tilesHolder && tilesHolder.offsetParent !== null) {
        handleAccountPicker();
        return;
      }
    }

    if (meta && meta.content === "ConvergedProofUpRedirect") {
      const link = document.getElementById(SKIP_LINK_ID);
      if (link) handleSkipPrompt(link);
    }
  }

  const observer = new MutationObserver(checkPage);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Periodic fallback: MS login pages start with body display:none and
  // become visible via a style change, which childList observers miss.
  const poll = setInterval(() => {
    checkPage();
    if (otpHandled || skipHandled) clearInterval(poll);
  }, 1000);

  checkPage();
})();
