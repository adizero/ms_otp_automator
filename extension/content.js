(function () {
  "use strict";

  const LOG_PREFIX = "MS OTP Automator:";
  const OTP_INPUT_ID = "idTxtBx_SAOTCC_OTC";
  const VERIFY_BUTTON_ID = "idSubmit_SAOTCC_Continue";
  const NUMBER_MATCH_ID = "idRichContext_DisplaySign";
  const SKIP_LINK_IDS = ["skipMfaRegistrationLink"];
  const SKIP_TEXT_RE = /skip\s*(for\s*now)?|ask\s*later|i.ll\s*do\s*it\s*later/i;
  const SUBMIT_DELAY_MS = 500;

  let otpHandled = false;
  let skipHandled = false;

  console.log(LOG_PREFIX, "content script loaded on", window.location.href);

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
    // Try known element ID first
    for (const id of SKIP_LINK_IDS) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    // Fallback: find any link with skip-related text
    const links = document.querySelectorAll("a[href]");
    for (const el of links) {
      const text = el.textContent || "";
      if (SKIP_TEXT_RE.test(text)) return el;
    }
    return null;
  }

  function isProofUpRedirectPage() {
    const meta = document.querySelector('meta[name="PageID"]');
    return meta && meta.content === "ConvergedProofUpRedirect";
  }

  function handleSkipPrompt(link) {
    if (skipHandled) return;
    skipHandled = true;

    chrome.storage.local.get("skipMfaRegistration", (data) => {
      // Default to true if not set
      const skip = data.skipMfaRegistration !== false;
      if (!skip) {
        console.log(LOG_PREFIX, "skip disabled by user setting");
        skipHandled = false;
        return;
      }
      console.log(LOG_PREFIX, "clicking skip link");
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

    if (isProofUpRedirectPage()) {
      const link = findSkipLink();
      console.log(LOG_PREFIX, "proof-up page, skip link:", link);
      if (link) {
        handleSkipPrompt(link);
      }
    }
  }

  const observer = new MutationObserver(() => {
    checkPage();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Periodic fallback: the MS login page body starts as display:none and
  // becomes visible via a style change, which childList observers don't catch.
  const poll = setInterval(() => {
    checkPage();
    if (otpHandled || skipHandled) clearInterval(poll);
  }, 1000);

  checkPage();
})();
