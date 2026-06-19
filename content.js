let extensionContextInvalid = false;
let latestSelectedText = "";
let extensionContextCheckTimer = null;
let autociteCaptureEnabled = false;

const AUTOCITE_BUTTON_ID = "autocite-floating-button";
const AUTOCITE_UI_ATTRIBUTE = "data-autocite-ui";
const AUTOCITE_INSTANCE_ATTRIBUTE = "data-autocite-instance";
const AUTOCITE_INSTANCE_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const AUTOCITE_LEGACY_ELEMENT_IDS = [
  AUTOCITE_BUTTON_ID,
  "autocite-sidebar-container",
  "autocite-overlay"
];
const SIDEBAR_STATE_KEY = "sidebarState";
const SIDEBAR_STATE_CLOSED = "closed";
const DEBUG_AUTOCITE = false;

function debugLog() {}

function getAutoCiteElements() {
  const elements = new Set(document.querySelectorAll(`[${AUTOCITE_UI_ATTRIBUTE}]`));

  AUTOCITE_LEGACY_ELEMENT_IDS.forEach((elementId) => {
    document.querySelectorAll(`[id="${elementId}"]`).forEach((element) => elements.add(element));
  });

  return Array.from(elements);
}

function cleanupAutoCiteUi({ allInstances = false } = {}) {
  getAutoCiteElements().forEach((element) => {
    if (allInstances || element.getAttribute(AUTOCITE_INSTANCE_ATTRIBUTE) === AUTOCITE_INSTANCE_ID) {
      element.remove();
    }
  });
}

function invalidateExtensionContext() {
  extensionContextInvalid = true;

  if (extensionContextCheckTimer !== null) {
    window.clearInterval(extensionContextCheckTimer);
    extensionContextCheckTimer = null;
  }

  cleanupAutoCiteUi();
}

function debugAuthorDetection(method, value) {
  if (!DEBUG_AUTOCITE) {
    return;
  }

  if (value) {
    debugLog(`[AutoCite] Author detected from ${method}:`, value);
  } else {
    debugLog(`[AutoCite] No author detected from ${method}.`);
  }
}

function getMetaContent(selectors) {
  for (const selector of selectors) {
    const tag = document.querySelector(selector);

    if (tag && tag.content) {
      return tag.content.trim();
    }
  }

  return "";
}

function getAllMetaContent(selectors) {
  const values = [];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((tag) => {
      if (tag && tag.content) {
        values.push(tag.content.trim());
      }
    });
  });

  return values.filter(Boolean);
}

function cleanDate(dateText) {
  if (!dateText) {
    return "";
  }

  const parsedDate = new Date(dateText);

  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().slice(0, 10);
  }

  return dateText.trim();
}

function cleanAuthorText(authorText) {
  return (authorText || "")
    .replace(/\b(written by|posted by|author:|authors:|by|published by|reviewed by)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s*[,;|]\s*$/, "")
    .replace(/^\W+|\W+$/g, "")
    .trim();
}

function splitAuthorText(authorText) {
  return (authorText || "")
    .split(/\s+and\s+|\s*&\s*|;|\|/i)
    .map(cleanAuthorText)
    .filter(isLikelyAuthorName)
    .filter((name) => !isLikelyNonAuthorText(name))
    .filter(Boolean);
}

function isLikelyAuthorName(name) {
  if (!name || name.length > 120) {
    return false;
  }

  if (/[•”“"()]|https?:\/\//i.test(name)) {
    return false;
  }

  const words = name.split(/\s+/).filter(Boolean);

  if (!words.length || words.length > 8) {
    return false;
  }

  return /[A-Za-z]/.test(name);
}

function isLikelyNonAuthorText(text) {
  const lower = text.toLowerCase();
  const blockedWords = [
    "abstract",
    "article preview",
    "highlights",
    "references",
    "recommended articles",
    "cited by",
    "metrics",
    "show more",
    "sign in",
    "my account",
    "journal",
    "journals",
    "book",
    "books",
    "search",
    "download",
    "purchase",
    "rights and content",
    "e-commerce",
    " vs. ",
    " doi "
  ];

  return blockedWords.some((word) => lower.includes(word));
}

function dedupeAuthors(authors) {
  const seen = new Set();

  return authors.filter((author) => {
    const key = author.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getTextFromSelectors(selectors) {
  const values = [];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      const nestedAuthorLinks = Array.from(element.querySelectorAll('a[rel="author"], a[href*="author"], a[href*="profile"], button, span'))
        .map((child) => (child.textContent || "").trim())
        .filter((text) => text && text.length < 120);

      if (nestedAuthorLinks.length > 1) {
        values.push(...nestedAuthorLinks);
        return;
      }

      const text = (element.getAttribute("content") || element.getAttribute("datetime") || element.textContent || "").trim();

      if (text) {
        values.push(text);
      }
    });
  });

  return values;
}

function getJsonLdObjects() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const objects = [];

  scripts.forEach((script) => {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];

      items.forEach((item) => {
        if (item && item["@graph"] && Array.isArray(item["@graph"])) {
          objects.push(...item["@graph"]);
        } else if (item) {
          objects.push(item);
        }
      });
    } catch (error) {
      // Some sites publish invalid JSON-LD. Ignore that block and continue.
    }
  });

  return objects;
}

function pickJsonLdField(object, path) {
  return path.split(".").reduce((value, key) => {
    if (!value) {
      return "";
    }

    return value[key];
  }, object);
}

function readStructuredName(value) {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return [cleanAuthorText(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap(readStructuredName);
  }

  if (value.name) {
    return readStructuredName(value.name);
  }

  if (value.givenName || value.familyName) {
    return [[value.givenName, value.familyName].filter(Boolean).join(" ")];
  }

  return [];
}

function detectAuthorsFromMeta() {
  const citationAuthors = getAllMetaContent([
    'meta[name="citation_author"]',
    'meta[property="citation_author"]'
  ]).flatMap(splitAuthorText);

  if (citationAuthors.length) {
    const cleanCitationAuthors = dedupeAuthors(citationAuthors);
    debugAuthorDetection("citation_author meta", cleanCitationAuthors.join("; "));
    return cleanCitationAuthors;
  }

  const authors = getAllMetaContent([
    'meta[name="author"]',
    'meta[property="article:author"]',
    'meta[property="article:author:name"]',
    'meta[name="byl"]',
    'meta[name="dc.creator"]',
    'meta[name="DC.Creator"]'
  ]).flatMap(splitAuthorText);

  const cleanAuthors = dedupeAuthors(authors);
  debugAuthorDetection("standard meta tags", cleanAuthors.join("; "));
  return cleanAuthors;
}

function detectAuthorsFromJsonLd() {
  const authors = [];
  const publisherFallbacks = [];

  getJsonLdObjects().forEach((object) => {
    authors.push(...readStructuredName(pickJsonLdField(object, "author")));
    authors.push(...readStructuredName(pickJsonLdField(object, "author.name")));
    authors.push(...readStructuredName(pickJsonLdField(object, "creator")));
    authors.push(...readStructuredName(pickJsonLdField(object, "creator.name")));

    // Publisher can help when the page has no person author, but it is only a fallback.
    publisherFallbacks.push(...readStructuredName(pickJsonLdField(object, "publisher")));
    publisherFallbacks.push(...readStructuredName(pickJsonLdField(object, "publisher.name")));
  });

  const cleanAuthors = dedupeAuthors(authors.flatMap(splitAuthorText));

  if (cleanAuthors.length) {
    debugAuthorDetection("JSON-LD author/creator", cleanAuthors.join("; "));
    return cleanAuthors;
  }

  const cleanPublishers = dedupeAuthors(publisherFallbacks.flatMap(splitAuthorText));

  if (cleanPublishers.length) {
    debugAuthorDetection("JSON-LD publisher fallback", cleanPublishers.join("; "));
    return cleanPublishers;
  }

  debugAuthorDetection("JSON-LD", "");
  return cleanAuthors;
}

function detectAuthorsFromByline() {
  const focusedBylineText = getTextFromSelectors([
    ".authors",
    ".Authors",
    ".author-list",
    ".author-group",
    ".article-authors",
    ".contrib-author",
    ".loa__author-name",
    ".loa__item__name",
    '[data-aa-name="author-name"]',
    '[data-testid*="author"]',
    ".author",
    ".byline",
    ".post-author",
    ".article-author",
    ".entry-author",
    ".story-author",
    ".news-author",
    '[rel="author"]'
  ]);

  const focusedAuthors = dedupeAuthors(focusedBylineText.flatMap(splitAuthorText));

  if (focusedAuthors.length) {
    debugAuthorDetection("visible byline", focusedAuthors.join("; "));
    return focusedAuthors;
  }

  const broadBylineText = getTextFromSelectors([
    '[class*="author"] a',
    '[class*="byline"] a',
    '[class*="Author"] a',
    '[class*="authors"]',
    '[class*="byline"]'
  ]);
  const broadAuthors = dedupeAuthors(broadBylineText.flatMap(splitAuthorText));
  debugAuthorDetection("broad visible byline fallback", broadAuthors.join("; "));
  return broadAuthors;
}

function detectAuthor() {
  const metaAuthors = detectAuthorsFromMeta();

  if (metaAuthors.length) {
    return metaAuthors.join("; ");
  }

  const jsonLdAuthors = detectAuthorsFromJsonLd();

  if (jsonLdAuthors.length) {
    return jsonLdAuthors.join("; ");
  }

  const bylineAuthors = detectAuthorsFromByline();

  if (bylineAuthors.length) {
    return bylineAuthors.join("; ");
  }

  debugAuthorDetection("all methods", "");
  return "";
}

function detectPublishedDate() {
  return cleanDate(getMetaContent([
    'meta[name="citation_publication_date"]',
    'meta[name="citation_date"]',
    'meta[property="article:published_time"]',
    'meta[property="og:published_time"]',
    'meta[name="date"]',
    'meta[name="dc.date"]',
    'meta[name="DC.Date"]',
    'meta[name="prism.publicationDate"]',
    'meta[name="pubdate"]',
    'meta[name="publishdate"]',
    'meta[name="publish-date"]',
    'meta[name="timestamp"]',
    'meta[itemprop="datePublished"]'
  ]) || getJsonLdObjects().map((object) => object.datePublished).find(Boolean) || getTextFromSelectors([
    'time[datetime]',
    ".date",
    ".published",
    ".post-date",
    ".article-date",
    '[class*="published"]',
    '[class*="post-date"]'
  ])[0] || "");
}

function detectSourceType(url) {
  const cleanUrl = (url || "").toLowerCase().split(/[?#]/)[0];
  const contentType = document.contentType || "";

  if (cleanUrl.endsWith(".pdf") || contentType === "application/pdf") {
    return "pdf";
  }

  return getMetaContent(['meta[name="citation_journal_title"]', 'meta[name="prism.publicationName"]']) ? "journal" : "website";
}

function getSourceDetails() {
  const url = window.location.href;
  const hostname = window.location.hostname.replace(/^www\./, "");
  const website = getMetaContent([
    'meta[property="og:site_name"]',
    'meta[name="application-name"]',
    'meta[name="publisher"]'
  ]) || hostname;

  return {
    sourceType: detectSourceType(url),
    title: getMetaContent([
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'meta[name="citation_title"]'
    ]) || document.title,
    website,
    publisher: getMetaContent([
      'meta[name="citation_publisher"]',
      'meta[name="publisher"]',
      'meta[property="article:publisher"]'
    ]),
    journalName: getMetaContent([
      'meta[name="citation_journal_title"]',
      'meta[name="prism.publicationName"]'
    ]),
    volume: getMetaContent([
      'meta[name="citation_volume"]',
      'meta[name="prism.volume"]'
    ]),
    issue: getMetaContent([
      'meta[name="citation_issue"]',
      'meta[name="prism.number"]'
    ]),
    pages: [
      getMetaContent([
      'meta[name="citation_firstpage"]',
      'meta[name="prism.startingPage"]'
      ]),
      getMetaContent([
        'meta[name="citation_lastpage"]',
        'meta[name="prism.endingPage"]'
      ])
    ].filter(Boolean).join("-"),
    url,
    author: detectAuthor(),
    publishedDate: detectPublishedDate(),
    accessDate: new Date().toISOString().slice(0, 10)
  };
}

function canUseChromeRuntime() {
  try {
    return !extensionContextInvalid &&
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      typeof chrome.runtime.id === "string" &&
      chrome.runtime.sendMessage;
  } catch (error) {
    invalidateExtensionContext();
    return false;
  }
}

function sendMessageToSidebar(message) {
  if (!canUseChromeRuntime()) {
    return;
  }

  try {
    chrome.runtime.sendMessage(message, () => {
      try {
        const ignoredError = chrome.runtime.lastError;
        debugLog("Message sent to sidebar");
      } catch (error) {
        invalidateExtensionContext();
      }
    });
  } catch (error) {
    invalidateExtensionContext();
  }
}

function saveCopiedSource(selectedText) {
  const copiedSource = {
    copiedText: selectedText,
    sourceDetails: getSourceDetails()
  };

  debugLog("Metadata extracted", copiedSource.sourceDetails);

  sendMessageToSidebar({
    type: "COPIED_TEXT_DETECTED",
    copiedSource
  });
}

function openAutoCiteSidebar() {
  if (!canUseChromeRuntime()) {
    console.error("[AutoCite] Cannot open sidebar because the extension context is unavailable.");
    return;
  }

  chrome.runtime.sendMessage({ type: "TOGGLE_AUTOCITE_SIDEBAR" }, (response) => {
    try {
      if (chrome.runtime.lastError) {
        console.error("[AutoCite] Sidebar open request failed.", chrome.runtime.lastError.message);
        return;
      }

      if (!response || !response.opened) {
        console.error("[AutoCite] Sidebar did not open.");
        return;
      }
    } catch (error) {
      invalidateExtensionContext();
    }
  });
}

function createFloatingButton() {
  const existingButtons = Array.from(document.querySelectorAll(`[id="${AUTOCITE_BUTTON_ID}"]`));
  const currentButton = existingButtons.find((button) => {
    return button.getAttribute(AUTOCITE_INSTANCE_ATTRIBUTE) === AUTOCITE_INSTANCE_ID;
  });

  if (currentButton) {
    existingButtons.filter((button) => button !== currentButton).forEach((button) => button.remove());
    return;
  }

  existingButtons.forEach((button) => button.remove());

  const button = document.createElement("button");
  button.id = AUTOCITE_BUTTON_ID;
  button.className = "autocite-injected-ui";
  button.type = "button";
  button.textContent = "Cite";
  button.setAttribute("aria-label", "Open AutoCite");
  button.setAttribute(AUTOCITE_UI_ATTRIBUTE, "floating-button");
  button.setAttribute(AUTOCITE_INSTANCE_ATTRIBUTE, AUTOCITE_INSTANCE_ID);

  Object.assign(button.style, {
    position: "fixed",
    right: "18px",
    bottom: "88px",
    zIndex: "2147483647",
    border: "0",
    borderRadius: "999px",
    background: "#315f72",
    color: "#ffffff",
    cursor: "pointer",
    font: "700 13px Arial, sans-serif",
    padding: "11px 14px",
    boxShadow: "0 10px 24px rgba(24, 33, 47, 0.18)",
    opacity: "0.92",
    transition: "opacity 160ms ease, transform 160ms ease, box-shadow 160ms ease"
  });

  button.addEventListener("mouseenter", () => {
    button.style.opacity = "1";
    button.style.transform = "translateY(-1px)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.opacity = "0.92";
    button.style.transform = "translateY(0)";
  });

  button.addEventListener("mousedown", () => {
    button.style.transform = "scale(0.96)";
  });

  button.addEventListener("mouseup", () => {
    button.style.transform = "translateY(-1px)";
  });

  button.addEventListener("click", openAutoCiteSidebar);

  document.documentElement.appendChild(button);
}

function showFloatingButton() {
  createFloatingButton();
}

function hideFloatingButton() {
  document.querySelectorAll(`[id="${AUTOCITE_BUTTON_ID}"]`).forEach((button) => button.remove());
}

function applySidebarState(sidebarState) {
  if (sidebarState === SIDEBAR_STATE_CLOSED) {
    autociteCaptureEnabled = false;
    showFloatingButton();
    return;
  }

  autociteCaptureEnabled = true;
  showFloatingButton();
}

function loadSidebarState() {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    invalidateExtensionContext();
    return;
  }

  try {
    chrome.storage.local.get([SIDEBAR_STATE_KEY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        invalidateExtensionContext();
        return;
      }

      applySidebarState(result[SIDEBAR_STATE_KEY]);
    });
  } catch (error) {
    invalidateExtensionContext();
  }
}

function startExtensionContextCheck() {
  if (extensionContextCheckTimer !== null) {
    return;
  }

  extensionContextCheckTimer = window.setInterval(() => {
    if (!canUseChromeRuntime()) {
      invalidateExtensionContext();
    }
  }, 2000);
}

function checkExtensionContext() {
  if (!canUseChromeRuntime()) {
    invalidateExtensionContext();
  }
}

try {
  if (!extensionContextInvalid && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "AUTOCITE_PING") {
        sendResponse({ ready: true });
        return;
      }

      if (message.type === "SHOW_AUTOCITE_BUTTON") {
        showFloatingButton();
        return;
      }

      if (message.type === "HIDE_AUTOCITE_BUTTON") {
        hideFloatingButton();
        return;
      }

      if (message.type === "CLEAR_AUTOCITE_SELECTION") {
        latestSelectedText = "";
        return;
      }

      if (message.type === "GET_PAGE_DETAILS") {
        sendResponse({
          sourceDetails: getSourceDetails(),
          selectedText: window.getSelection().toString() || latestSelectedText
        });
      }
    });
  }

  if (!extensionContextInvalid && typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes[SIDEBAR_STATE_KEY]) {
        applySidebarState(changes[SIDEBAR_STATE_KEY].newValue);
      }
    });
  }
} catch (error) {
  invalidateExtensionContext();
}

window.addEventListener("focus", checkExtensionContext);
window.addEventListener("pagehide", () => cleanupAutoCiteUi());
window.addEventListener("pageshow", (event) => {
  if (event.persisted && !extensionContextInvalid) {
    loadSidebarState();
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    checkExtensionContext();
  }
});

document.addEventListener("mouseup", () => {
  const selectedText = window.getSelection().toString().trim();

  if (selectedText) {
    latestSelectedText = selectedText;
  }
});

document.addEventListener("copy", (event) => {
  if (!autociteCaptureEnabled) {
    return;
  }

  const clipboardText = event.clipboardData ? event.clipboardData.getData("text/plain").trim() : "";
  const selectedText = (window.getSelection().toString() || clipboardText || latestSelectedText).trim();

  if (selectedText) {
    latestSelectedText = selectedText;
    saveCopiedSource(selectedText);
  }
});

function initializeAutoCiteUi() {
  cleanupAutoCiteUi({ allInstances: true });
  startExtensionContextCheck();
  loadSidebarState();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeAutoCiteUi, { once: true });
} else {
  initializeAutoCiteUi();
}
