// AutoCite background script
// This file runs quietly in the background and controls extension-wide behavior.

// When the extension is installed, tell Chrome which page should appear in the side panel.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// If the user clicks the AutoCite extension icon, Chrome will open the side panel.
// The openPanelOnActionClick setting above handles that for us in Manifest V3.
chrome.action.onClicked.addListener((tab) => {
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "SHOW_AUTOCITE_BUTTON" });
  }
});

function isValidCopiedSource(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.copiedText === "string" &&
    value.sourceDetails &&
    typeof value.sourceDetails === "object"
  );
}

// Open the side panel when the webpage floating button is clicked.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "COPIED_TEXT_DETECTED") {
    if (!sender.tab || !isValidCopiedSource(message.copiedSource)) {
      return;
    }

    chrome.storage.local.set({
      latestCopiedSource: message.copiedSource,
      latestSelectedText: message.copiedSource && message.copiedSource.copiedText
    }, () => {
      // Re-send the saved copy event so an open sidebar updates immediately.
      // If the sidebar is closed, the data is still ready in storage for the next open.
      chrome.runtime.sendMessage({
        type: "AUTOCITE_COPIED_SOURCE_UPDATED",
        copiedSource: message.copiedSource
      }, () => {
        const ignoredError = chrome.runtime.lastError;
        // No sidebar is open right now. That is okay because storage has the latest data.
      });
    });

    return;
  }

  if (message.type !== "OPEN_AUTOCITE_SIDEBAR") {
    return;
  }

  const tabId = sender.tab && sender.tab.id;

  if (!tabId || !chrome.sidePanel || !chrome.sidePanel.open) {
    sendResponse({ opened: false });
    return;
  }

  chrome.sidePanel.open({ tabId })
    .then(() => {
      sendResponse({ opened: true });
    })
    .catch(() => {
      sendResponse({ opened: false });
    });

  return true;
});
