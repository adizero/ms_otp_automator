const HOST_NAME = "com.ms_otp_automator";

function getOtp(command) {
  return new Promise((resolve, reject) => {
    let port;
    try {
      port = chrome.runtime.connectNative(HOST_NAME);
    } catch (e) {
      reject(new Error("Failed to connect to native host: " + e.message));
      return;
    }

    let responded = false;

    port.onMessage.addListener((msg) => {
      responded = true;
      port.disconnect();
      if (msg.error) {
        reject(new Error(msg.error));
      } else {
        resolve(msg.otp);
      }
    });

    port.onDisconnect.addListener(() => {
      if (!responded) {
        const err = chrome.runtime.lastError
          ? chrome.runtime.lastError.message
          : "Native host disconnected";
        reject(new Error(err));
      }
    });

    port.postMessage({ command: command });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_OTP") {
    chrome.storage.local.get("oathtoolCommand", (data) => {
      const command = data.oathtoolCommand;
      if (!command) {
        sendResponse({ error: "No oathtool command configured" });
        return;
      }
      getOtp(command)
        .then((otp) => sendResponse({ otp }))
        .catch((err) => sendResponse({ error: err.message }));
    });
    return true; // keep message channel open for async response
  }

  if (request.type === "CLICK_SIGNIN") {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: "MAIN",
      func: (passwordId, buttonId) => {
        const input = document.getElementById(passwordId);
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype, "value"
          ).set;
          setter.call(input, input.value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        setTimeout(() => {
          const btn = document.getElementById(buttonId);
          if (btn) btn.click();
        }, 500);
      },
      args: [request.passwordId, request.buttonId],
    });
    return false;
  }

  if (request.type === "TEST_OTP") {
    getOtp(request.command)
      .then((otp) => sendResponse({ otp }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});
