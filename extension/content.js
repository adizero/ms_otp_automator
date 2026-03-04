(function () {
  "use strict";

  const OTP_INPUT_ID = "idTxtBx_SAOTCC_OTC";
  const VERIFY_BUTTON_ID = "idSubmit_SAOTCC_Continue";
  const NUMBER_MATCH_ID = "idRichContext_DisplaySign";
  const SKIP_LINK_IDS = ["skipMfaRegistrationLink"];
  const SKIP_TEXT_RE = /skip\s*(for\s*now)?|ask\s*later|i.ll\s*do\s*it\s*later/i;
  const SUBMIT_DELAY_MS = 500;

  let otpHandled = false;
  let skipHandled = false;

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

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && el.offsetWidth > 0;
  }

  function findSkipLink() {
    // Try known element IDs first
    for (const id of SKIP_LINK_IDS) {
      const el = document.getElementById(id);
      if (isVisible(el)) return el;
    }
    // Fallback: find any clickable element with skip-related text
    const clickables = document.querySelectorAll("a, button, input[type='button'], input[type='submit'], div[role='button'], span[role='button']");
    for (const el of clickables) {
      const text = el.textContent || el.value || "";
      if (SKIP_TEXT_RE.test(text) && isVisible(el)) return el;
    }
    return null;
  }

  function handleSkipPrompt(link) {
    if (skipHandled) return;
    skipHandled = true;

    chrome.storage.local.get("skipMfaRegistration", (data) => {
      // Default to true if not set
      const skip = data.skipMfaRegistration !== false;
      if (!skip) {
        skipHandled = false;
        return;
      }
      link.click();
    });
  }

  function checkPage() {
    const otpInput = document.getElementById(OTP_INPUT_ID);
    if (isVisible(otpInput)) {
      handleOtpInput();
      return;
    }

    const numberMatch = document.getElementById(NUMBER_MATCH_ID);
    if (isVisible(numberMatch)) {
      handleNumberMatch(numberMatch);
      return;
    }

    const skipLink = findSkipLink();
    if (skipLink) {
      handleSkipPrompt(skipLink);
    }
  }

  const observer = new MutationObserver(() => {
    checkPage();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  checkPage();
})();
