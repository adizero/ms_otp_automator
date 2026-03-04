const commandInput = document.getElementById("command");
const skipMfaCheckbox = document.getElementById("skipMfa");
const autoPasswordCheckbox = document.getElementById("autoPassword");
const passwordInput = document.getElementById("password");
const passwordGroup = document.getElementById("passwordGroup");
const autoSelectCheckbox = document.getElementById("autoSelect");
const accountNameInput = document.getElementById("accountName");
const accountNameGroup = document.getElementById("accountNameGroup");
const saveBtn = document.getElementById("save");
const testBtn = document.getElementById("test");
const statusEl = document.getElementById("status");
const extIdEl = document.getElementById("extId");

extIdEl.textContent = chrome.runtime.id;

function showStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "error" : "success";
}

function togglePasswordGroup() {
  passwordGroup.style.display = autoPasswordCheckbox.checked ? "" : "none";
}

function toggleAccountNameGroup() {
  accountNameGroup.style.display = autoSelectCheckbox.checked ? "" : "none";
}

autoPasswordCheckbox.addEventListener("change", togglePasswordGroup);
autoSelectCheckbox.addEventListener("change", toggleAccountNameGroup);

chrome.storage.local.get(
  ["oathtoolCommand", "skipMfaRegistration",
   "autoFillPassword", "autoFillPasswordValue",
   "autoSelectAccount", "autoSelectAccountName"],
  (data) => {
    if (data.oathtoolCommand) {
      commandInput.value = data.oathtoolCommand;
    }
    // Default to true if not set
    skipMfaCheckbox.checked = data.skipMfaRegistration !== false;
    autoPasswordCheckbox.checked = data.autoFillPassword !== false;
    passwordInput.value = data.autoFillPasswordValue || "";
    togglePasswordGroup();
    autoSelectCheckbox.checked = data.autoSelectAccount !== false;
    accountNameInput.value = data.autoSelectAccountName || "";
    toggleAccountNameGroup();
  }
);

saveBtn.addEventListener("click", () => {
  const command = commandInput.value.trim();
  if (!command) {
    showStatus("Command cannot be empty", true);
    return;
  }
  chrome.storage.local.set({
    oathtoolCommand: command,
    skipMfaRegistration: skipMfaCheckbox.checked,
    autoFillPassword: autoPasswordCheckbox.checked,
    autoFillPasswordValue: passwordInput.value,
    autoSelectAccount: autoSelectCheckbox.checked,
    autoSelectAccountName: accountNameInput.value.trim(),
  }, () => {
    showStatus("Saved");
  });
});

testBtn.addEventListener("click", () => {
  const command = commandInput.value.trim();
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
        showStatus("OTP: " + response.otp);
      }
    }
  );
});
