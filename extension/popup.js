const commandInput = document.getElementById("command");
const saveBtn = document.getElementById("save");
const testBtn = document.getElementById("test");
const statusEl = document.getElementById("status");

function showStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "error" : "success";
}

chrome.storage.local.get("oathtoolCommand", (data) => {
  if (data.oathtoolCommand) {
    commandInput.value = data.oathtoolCommand;
  }
});

saveBtn.addEventListener("click", () => {
  const command = commandInput.value.trim();
  if (!command) {
    showStatus("Command cannot be empty", true);
    return;
  }
  chrome.storage.local.set({ oathtoolCommand: command }, () => {
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
