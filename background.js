// AutoCite background script
// This file runs quietly in the background and controls extension-wide behavior.

function enableActionClickToOpenPanel() {
  if (!chrome.sidePanel || !chrome.sidePanel.setPanelBehavior) {
    return;
  }

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    console.error("[AutoCite] Could not enable toolbar side panel behavior.", error);
  });
}

const SIDEBAR_STATE_KEY = "sidebarState";
const SIDEBAR_STATE_OPEN = "open";
const VALID_SIDEBAR_STATES = new Set(["open", "minimized", "closed"]);

async function initializeSidebarState() {
  try {
    const result = await chrome.storage.local.get([SIDEBAR_STATE_KEY]);

    if (!VALID_SIDEBAR_STATES.has(result[SIDEBAR_STATE_KEY])) {
      await chrome.storage.local.set({ [SIDEBAR_STATE_KEY]: SIDEBAR_STATE_OPEN });
    }
  } catch (error) {
    console.error("[AutoCite] Could not initialize sidebar state.", error);
  }
}

// Apply this on every service-worker start as well as install/update.
enableActionClickToOpenPanel();
initializeSidebarState();
chrome.runtime.onInstalled.addListener(enableActionClickToOpenPanel);

async function openAutoCiteSidebar(tab) {
  console.log("Opening sidebar");

  if (!tab || typeof tab.id !== "number" || !chrome.sidePanel || !chrome.sidePanel.open) {
    console.error("[AutoCite] Side Panel API is unavailable for this tab.");
    return false;
  }

  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    await chrome.storage.local.set({ [SIDEBAR_STATE_KEY]: SIDEBAR_STATE_OPEN });
    console.log("Sidebar opened successfully");
    return true;
  } catch (error) {
    console.error("[AutoCite] Failed to open sidebar.", error);
    return false;
  }
}

// If the user clicks the AutoCite extension icon, Chrome will open the side panel.
chrome.action.onClicked.addListener((tab) => {
  openAutoCiteSidebar(tab);
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

  openAutoCiteSidebar(sender.tab).then((opened) => {
    sendResponse({ opened });
  });

  return true;
});
