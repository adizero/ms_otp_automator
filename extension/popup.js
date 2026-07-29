const enabledCheckbox = document.getElementById("enabled");
const commandInput = document.getElementById("command");
const skipMfaCheckbox = document.getElementById("skipMfa");
const autoPasswordCheckbox = document.getElementById("autoPassword");
const passwordInput = document.getElementById("password");
const passwordGroup = document.getElementById("passwordGroup");
const autoSelectCheckbox = document.getElementById("autoSelect");
const accountNameInput = document.getElementById("accountName");
const accountNameGroup = document.getElementById("accountNameGroup");
const settingsDiv = document.getElementById("settings");
const globalToggleDiv = enabledCheckbox.closest(".global-toggle");
const testBtn = document.getElementById("test");
const statusEl = document.getElementById("status");
const copyBtn = document.getElementById("copy");
const extIdEl = document.getElementById("extId");

let lastOtp = "";

extIdEl.textContent = chrome.runtime.id;

function showStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "error" : "success";
}

function setOtp(otp) {
  lastOtp = otp || "";
  copyBtn.style.display = lastOtp ? "inline-block" : "none";
  copyBtn.textContent = "Copy";
}

function save() {
  chrome.storage.local.set({
    enabled: enabledCheckbox.checked,
    oathtoolCommand: commandInput.value.trim(),
    skipMfaRegistration: skipMfaCheckbox.checked,
    autoFillPassword: autoPasswordCheckbox.checked,
    autoFillPasswordValue: passwordInput.value,
    autoSelectAccount: autoSelectCheckbox.checked,
    autoSelectAccountName: accountNameInput.value.trim(),
  });
}

function toggleEnabled() {
  const on = enabledCheckbox.checked;
  settingsDiv.classList.toggle("disabled", !on);
  globalToggleDiv.classList.toggle("disabled", !on);
}

function togglePasswordGroup() {
  passwordGroup.style.display = autoPasswordCheckbox.checked ? "" : "none";
}

function toggleAccountNameGroup() {
  accountNameGroup.style.display = autoSelectCheckbox.checked ? "" : "none";
}

enabledCheckbox.addEventListener("change", () => { toggleEnabled(); save(); });
skipMfaCheckbox.addEventListener("change", save);
autoPasswordCheckbox.addEventListener("change", () => { togglePasswordGroup(); save(); });
autoSelectCheckbox.addEventListener("change", () => { toggleAccountNameGroup(); save(); });
commandInput.addEventListener("change", save);
passwordInput.addEventListener("change", save);
accountNameInput.addEventListener("change", save);

chrome.storage.local.get(
  ["enabled", "oathtoolCommand", "skipMfaRegistration",
   "autoFillPassword", "autoFillPasswordValue",
   "autoSelectAccount", "autoSelectAccountName"],
  (data) => {
    enabledCheckbox.checked = data.enabled !== false;
    toggleEnabled();
    if (data.oathtoolCommand) {
      commandInput.value = data.oathtoolCommand;
    }
    skipMfaCheckbox.checked = data.skipMfaRegistration !== false;
    autoPasswordCheckbox.checked = data.autoFillPassword !== false;
    passwordInput.value = data.autoFillPasswordValue || "";
    togglePasswordGroup();
    autoSelectCheckbox.checked = data.autoSelectAccount !== false;
    accountNameInput.value = data.autoSelectAccountName || "";
    toggleAccountNameGroup();
  }
);

testBtn.addEventListener("click", () => {
  const command = commandInput.value.trim();
  setOtp("");
  if (!command) {
    showStatus("Enter a command first", true);
    return;
  }
  showStatus("Testing...");
  statusEl.className = "success";

  chrome.runtime.sendMessage(
    { type: "TEST_OTP", command: command },
    (response) => {
      if (chrome.runtime.lastError) {
        showStatus("Error: " + chrome.runtime.lastError.message, true);
        return;
      }
      if (response.error) {
        showStatus("Error: " + response.error, true);
      } else {
        const via = response.source === "builtin"
          ? "built-in TOTP — " + (response.reason || "oathtool unavailable")
          : "oathtool command";
        showStatus("OTP: " + response.otp + "\ncomputed by: " + via);
        setOtp(response.otp);
      }
    }
  );
});

copyBtn.addEventListener("click", async () => {
  if (!lastOtp) return;
  try {
    await navigator.clipboard.writeText(lastOtp);
    copyBtn.textContent = "Copied";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
  } catch (e) {
    showStatus("Copy failed: " + e.message, true);
  }
});
