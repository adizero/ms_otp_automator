const commandInput = document.getElementById("command");
const skipMfaCheckbox = document.getElementById("skipMfa");
const saveBtn = document.getElementById("save");
const testBtn = document.getElementById("test");
const statusEl = document.getElementById("status");
const extIdEl = document.getElementById("extId");

extIdEl.textContent = chrome.runtime.id;

function showStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "error" : "success";
}

chrome.storage.local.get(["oathtoolCommand", "skipMfaRegistration"], (data) => {
  if (data.oathtoolCommand) {
    commandInput.value = data.oathtoolCommand;
  }
  // Default to true if not set
  skipMfaCheckbox.checked = data.skipMfaRegistration !== false;
});

saveBtn.addEventListener("click", () => {
  const command = commandInput.value.trim();
  if (!command) {
    showStatus("Command cannot be empty", true);
    return;
  }
  chrome.storage.local.set({
    oathtoolCommand: command,
    skipMfaRegistration: skipMfaCheckbox.checked,
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
