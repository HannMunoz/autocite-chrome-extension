// Sidebar-side page metadata bridge.
// content.js extracts metadata from webpages; this file asks it for details.
(() => {
const Security = window.AutoCiteSecurity;

function canUseChromeTabs() {
  return typeof chrome !== "undefined" && chrome.tabs && chrome.runtime;
}

function getFallbackDetailsFromTab(activeTab) {
  const url = Security.sanitizeUrl(activeTab && activeTab.url ? activeTab.url : "");
  const cleanUrl = url.toLowerCase().split(/[?#]/)[0];
  const isPdf = cleanUrl.endsWith(".pdf");
  const fallbackTitle = Security.sanitizeText(activeTab && activeTab.title ? activeTab.title.replace(/\.pdf$/i, "") : "");

  return {
    sourceType: isPdf ? "pdf" : "website",
    title: fallbackTitle,
    website: "",
    publisher: "",
    journalName: "",
    volume: "",
    issue: "",
    pages: "",
    url,
    author: "",
    publishedDate: "",
    accessDate: new Date().toISOString().slice(0, 10)
  };
}

function sendMessageToActiveTab(message) {
  if (!canUseChromeTabs()) {
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
    if (!activeTab || !activeTab.id) {
      return;
    }

    chrome.tabs.sendMessage(activeTab.id, message, () => {
      const ignoredError = chrome.runtime.lastError;
    });
  });
}

async function getActivePageDetails(onSuccess, onFallback) {
  if (!canUseChromeTabs()) {
    onFallback();
    return;
  }

  let activeTab;

  try {
    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (error) {
    onFallback();
    return;
  }

  if (!activeTab || !activeTab.id) {
    onFallback();
    return;
  }

  chrome.tabs.sendMessage(activeTab.id, { type: "GET_PAGE_DETAILS" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      if (activeTab.url) {
        onSuccess({
          sourceDetails: getFallbackDetailsFromTab(activeTab),
          selectedText: ""
        });
      } else {
        onFallback();
      }
      return;
    }

    onSuccess({
      sourceDetails: Security.sanitizeSourceDetails(response.sourceDetails),
      selectedText: Security.sanitizeCopiedText(response.selectedText)
    });
  });
}

window.AutoCiteMetadata = {
  canUseChromeTabs,
  sendMessageToActiveTab,
  getActivePageDetails
};
})();
