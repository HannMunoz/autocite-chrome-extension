// AutoCite background script.
// Content scripts are injected only after the user opens AutoCite on a tab.

const SIDEBAR_STATE_KEY = "sidebarState";
const SIDEBAR_STATE_OPEN = "open";
const SIDEBAR_STATE_CLOSED = "closed";
const VALID_SIDEBAR_STATES = new Set(["open", "minimized", "closed"]);
const MAX_TEXT_LENGTH = 100000;
const MAX_FIELD_LENGTH = 2000;
const SENSITIVE_QUERY_PARAMETERS = [
  "access_token",
  "auth",
  "auth_token",
  "code",
  "id_token",
  "jwt",
  "key",
  "login_token",
  "password",
  "refresh_token",
  "secret",
  "session",
  "sessionid",
  "sid",
  "signature",
  "token"
];
const TRACKING_PARAMETERS = ["fbclid", "gclid", "dclid", "msclkid"];

async function initializeSidebarState() {
  try {
    const result = await chrome.storage.local.get([SIDEBAR_STATE_KEY]);

    if (!VALID_SIDEBAR_STATES.has(result[SIDEBAR_STATE_KEY])) {
      await chrome.storage.local.set({ [SIDEBAR_STATE_KEY]: SIDEBAR_STATE_CLOSED });
    }
  } catch (error) {
    console.error("[AutoCite] Could not initialize sidebar state.", error);
  }
}

function sanitizeText(value, maxLength = MAX_FIELD_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .slice(0, maxLength)
    .trim();
}

function sanitizeCopiedText(value) {
  return sanitizeText(value, MAX_TEXT_LENGTH);
}

function sanitizeUrl(value) {
  const cleanValue = sanitizeText(value, MAX_FIELD_LENGTH);

  if (!cleanValue) {
    return "";
  }

  if (/^10\.\d{4,9}\/\S+$/i.test(cleanValue)) {
    return cleanValue;
  }

  try {
    const parsedUrl = new URL(cleanValue);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return "";
    }

    parsedUrl.username = "";
    parsedUrl.password = "";
    parsedUrl.hash = "";

    Array.from(parsedUrl.searchParams.keys()).forEach((key) => {
      const lowerKey = key.toLowerCase();
      const looksSensitive = SENSITIVE_QUERY_PARAMETERS.some((parameter) => {
        return lowerKey === parameter || lowerKey.endsWith(`_${parameter}`) || lowerKey.endsWith(`-${parameter}`);
      });

      if (lowerKey.startsWith("utm_") || TRACKING_PARAMETERS.includes(lowerKey) || looksSensitive) {
        parsedUrl.searchParams.delete(key);
      }
    });

    return parsedUrl.href;
  } catch (error) {
    return "";
  }
}

function sanitizeSourceDetails(details) {
  const source = details && typeof details === "object" ? details : {};
  const allowedSourceTypes = ["website", "pdf", "book", "journal"];

  return {
    sourceType: allowedSourceTypes.includes(source.sourceType) ? source.sourceType : "website",
    title: sanitizeText(source.title),
    website: sanitizeText(source.website),
    publisher: sanitizeText(source.publisher),
    journalName: sanitizeText(source.journalName),
    volume: sanitizeText(source.volume, 100),
    issue: sanitizeText(source.issue, 100),
    pages: sanitizeText(source.pages, 100),
    url: sanitizeUrl(source.url),
    author: sanitizeText(source.author),
    publishedDate: sanitizeText(source.publishedDate, 100),
    accessDate: sanitizeText(source.accessDate, 100)
  };
}

function sanitizeCopiedSource(copiedSource) {
  const source = copiedSource && typeof copiedSource === "object" ? copiedSource : {};

  return {
    copiedText: sanitizeCopiedText(source.copiedText),
    sourceDetails: sanitizeSourceDetails(source.sourceDetails)
  };
}

function canInjectIntoTab(tab) {
  return Boolean(tab && typeof tab.id === "number" && /^https?:\/\//i.test(tab.url || ""));
}

async function injectContentScript(tab) {
  if (!canInjectIntoTab(tab)) {
    return false;
  }

  const alreadyInjected = await new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { type: "AUTOCITE_PING" }, (response) => {
      const ignoredError = chrome.runtime.lastError;
      resolve(Boolean(response && response.ready));
    });
  });

  if (alreadyInjected) {
    return true;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    return true;
  } catch (error) {
    if (!String(error && error.message || "").includes("Cannot access")) {
      console.warn("[AutoCite] Could not inject content script.", error);
    }
    return false;
  }
}

async function openAutoCiteSidebar(tab) {
  if (!tab || typeof tab.id !== "number" || !chrome.sidePanel || !chrome.sidePanel.open) {
    console.error("[AutoCite] Side Panel API is unavailable for this tab.");
    return false;
  }

  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    await chrome.storage.local.set({ [SIDEBAR_STATE_KEY]: SIDEBAR_STATE_OPEN });
    await injectContentScript(tab);
    return true;
  } catch (error) {
    console.error("[AutoCite] Failed to open sidebar.", error);
    return false;
  }
}

async function closeAutoCiteSidebar() {
  try {
    await chrome.storage.local.set({ [SIDEBAR_STATE_KEY]: SIDEBAR_STATE_CLOSED });
    chrome.runtime.sendMessage({ type: "AUTOCITE_CLOSE_SIDEBAR" }, () => {
      const ignoredError = chrome.runtime.lastError;
    });
    return true;
  } catch (error) {
    console.error("[AutoCite] Failed to close sidebar.", error);
    return false;
  }
}

async function toggleAutoCiteSidebar(tab) {
  try {
    const result = await chrome.storage.local.get([SIDEBAR_STATE_KEY]);

    if (result[SIDEBAR_STATE_KEY] === SIDEBAR_STATE_OPEN) {
      return closeAutoCiteSidebar();
    }

    return openAutoCiteSidebar(tab);
  } catch (error) {
    console.error("[AutoCite] Failed to toggle sidebar.", error);
    return false;
  }
}

function isValidCopiedSource(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.copiedText === "string" &&
    value.sourceDetails &&
    typeof value.sourceDetails === "object"
  );
}

initializeSidebarState();

chrome.action.onClicked.addListener((tab) => {
  toggleAutoCiteSidebar(tab);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "COPIED_TEXT_DETECTED") {
    if (!sender.tab || !isValidCopiedSource(message.copiedSource)) {
      return;
    }

    const safeCopiedSource = sanitizeCopiedSource(message.copiedSource);

    if (!safeCopiedSource.copiedText) {
      return;
    }

    chrome.storage.local.set({
      latestCopiedSource: safeCopiedSource,
      latestSelectedText: safeCopiedSource.copiedText
    }, () => {
      chrome.runtime.sendMessage({
        type: "AUTOCITE_COPIED_SOURCE_UPDATED",
        copiedSource: safeCopiedSource
      }, () => {
        const ignoredError = chrome.runtime.lastError;
      });
    });

    return;
  }

  if (message.type !== "TOGGLE_AUTOCITE_SIDEBAR" && message.type !== "OPEN_AUTOCITE_SIDEBAR") {
    return;
  }

  const sidebarAction = message.type === "TOGGLE_AUTOCITE_SIDEBAR" ? toggleAutoCiteSidebar : openAutoCiteSidebar;

  sidebarAction(sender.tab).then((opened) => {
    sendResponse({ opened });
  });

  return true;
});
