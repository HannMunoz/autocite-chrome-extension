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
  let website = "";

  try {
    website = url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch (error) {
    website = "";
  }

  return {
    sourceType: isPdf ? "pdf" : "website",
    title: fallbackTitle,
    website,
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

function isPdfTab(activeTab) {
  const cleanUrl = Security.sanitizeUrl(activeTab && activeTab.url ? activeTab.url : "").toLowerCase().split(/[?#]/)[0];
  const title = Security.sanitizeText(activeTab && activeTab.title ? activeTab.title : "");
  return cleanUrl.endsWith(".pdf") || /\.pdf$/i.test(title);
}

function getPdfDetailsFromBackground(activeTab, onSuccess, onFallback) {
  if (!chrome.runtime || !chrome.runtime.sendMessage) {
    onFallback();
    return;
  }

  chrome.runtime.sendMessage({
    type: "EXTRACT_PDF_DETAILS",
    url: activeTab.url,
    title: activeTab.title || ""
  }, (response) => {
    if (chrome.runtime.lastError || !response || !response.sourceDetails) {
      onSuccess({
        sourceDetails: getFallbackDetailsFromTab(activeTab),
        selectedText: ""
      });
      return;
    }

    onSuccess({
      sourceDetails: Security.sanitizeSourceDetails(response.sourceDetails),
      selectedText: ""
    });
  });
}

function urlsMatchForActiveTabScan(pastedUrl, activeTabUrl) {
  try {
    const pasted = new URL(pastedUrl);
    const active = new URL(activeTabUrl);

    pasted.hash = "";
    active.hash = "";
    return pasted.href === active.href;
  } catch (error) {
    return false;
  }
}

async function getActiveTab() {
  if (!canUseChromeTabs()) {
    return null;
  }

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return activeTab || null;
  } catch (error) {
    return null;
  }
}

async function scanUrlDetails(url) {
  const safeUrl = Security.sanitizeUrl(url);

  if (!safeUrl || !chrome.runtime || !chrome.runtime.sendMessage) {
    return null;
  }

  const activeTab = await getActiveTab();
  const activeUrl = Security.sanitizeUrl(activeTab && activeTab.url ? activeTab.url : "");

  if (!urlsMatchForActiveTabScan(safeUrl, activeUrl)) {
    return null;
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: "SCAN_URL_DETAILS",
      url: safeUrl
    }, (response) => {
      if (chrome.runtime.lastError || !response || !response.sourceDetails) {
        resolve(null);
        return;
      }

      resolve(Security.sanitizeSourceDetails(response.sourceDetails));
    });
  });
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
      if (isPdfTab(activeTab)) {
        getPdfDetailsFromBackground(activeTab, onSuccess, onFallback);
        return;
      }

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
  getActivePageDetails,
  scanUrlDetails
};
})();
