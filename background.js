// AutoCite background script.
// Content scripts are injected only after the user opens AutoCite on a tab.

const SIDEBAR_STATE_KEY = "sidebarState";
const SIDEBAR_STATE_OPEN = "open";
const SIDEBAR_STATE_CLOSED = "closed";
const SIDEBAR_STATE_DISMISSED = "dismissed";
const VALID_SIDEBAR_STATES = new Set(["open", "minimized", "closed", "dismissed"]);
const tabSidebarStates = new Map();
let globalSidebarState = SIDEBAR_STATE_CLOSED;
let fallbackSidebarWindowId = null;
let fallbackSidebarTabId = null;
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
const PDF_METADATA_BYTES = 1024 * 1024;
const HTML_METADATA_BYTES = 512 * 1024;
const METADATA_FETCH_TIMEOUT_MS = 8000;
const DOI_PATTERN = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;

async function initializeSidebarState() {
  try {
    const result = await chrome.storage.local.get([SIDEBAR_STATE_KEY]);

    if (!VALID_SIDEBAR_STATES.has(result[SIDEBAR_STATE_KEY])) {
      await chrome.storage.local.set({ [SIDEBAR_STATE_KEY]: SIDEBAR_STATE_CLOSED });
      globalSidebarState = SIDEBAR_STATE_CLOSED;
    } else {
      globalSidebarState = result[SIDEBAR_STATE_KEY];
    }
  } catch (error) {
    // Sidebar state can recover on the next user action; avoid surfacing a
    // non-critical storage hiccup as a Chrome extension error.
    console.warn("[AutoCite] Sidebar state will be initialized later.", error);
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

function cleanDoi(value) {
  return sanitizeText(value, 500)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/[)\].,;:!?]+$/g, "")
    .trim();
}

function extractDoi(value) {
  const cleanValue = sanitizeText(value, MAX_TEXT_LENGTH);
  const doiUrlMatch = cleanValue.match(/https?:\/\/(?:dx\.)?doi\.org\/(10\.\d{4,9}\/[^\s<>"']+)/i);

  if (doiUrlMatch) {
    return cleanDoi(doiUrlMatch[1]);
  }

  const doiMatch = cleanValue.match(DOI_PATTERN);
  return doiMatch ? cleanDoi(doiMatch[0]) : "";
}

function sanitizeUrl(value) {
  const cleanValue = sanitizeText(value, MAX_FIELD_LENGTH);
  const doi = extractDoi(cleanValue);

  if (!cleanValue) {
    return "";
  }

  if (doi && /^(?:doi:\s*)?(?:https?:\/\/(?:dx\.)?doi\.org\/)?10\.\d{4,9}\/\S+$/i.test(cleanValue)) {
    return doi;
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

function isPdfUrl(value) {
  return /\.pdf(?:[?#]|$)/i.test(value || "");
}

function getWebsiteFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function cleanPdfTitle(value, url) {
  const cleanValue = sanitizeText(value)
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanValue) {
    return cleanValue;
  }

  try {
    return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "")
      .replace(/\.pdf$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
  } catch (error) {
    return "";
  }
}

function decodePdfString(value) {
  if (!value) {
    return "";
  }

  const hexMatch = value.match(/^<([0-9a-f\s]+)>$/i);

  if (hexMatch) {
    const bytes = (hexMatch[1].replace(/\s+/g, "").match(/.{1,2}/g) || []).map((hex) => parseInt(hex, 16));

    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return String.fromCharCode(...bytes.slice(2).reduce((chars, byte, index, array) => {
        if (index % 2 === 0) {
          chars.push((byte << 8) | (array[index + 1] || 0));
        }

        return chars;
      }, []));
    }

    return String.fromCharCode(...bytes);
  }

  return value
    .replace(/^[(]|[)]$/g, "")
    .replace(/\\([nrtbf()\\])/g, (match, escaped) => {
      return { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" }[escaped] || escaped;
    })
    .replace(/\\([0-7]{1,3})/g, (match, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXmlText(value) {
  return sanitizeText(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlText(value) {
  return sanitizeText(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getHtmlAttribute(tagText, attributeName) {
  const pattern = new RegExp(`\\s${attributeName}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'=<>` + "`" + `]+))`, "i");
  const match = tagText.match(pattern);
  return match ? decodeHtmlText(match[2] || match[3] || match[4] || "") : "";
}

function getMetaMap(htmlText) {
  const meta = new Map();
  const metaPattern = /<meta\b[^>]*>/gi;
  let match;

  while ((match = metaPattern.exec(htmlText))) {
    const tagText = match[0];
    const key = (
      getHtmlAttribute(tagText, "name") ||
      getHtmlAttribute(tagText, "property") ||
      getHtmlAttribute(tagText, "itemprop")
    ).toLowerCase();
    const content = getHtmlAttribute(tagText, "content");

    if (key && content && !meta.has(key)) {
      meta.set(key, content);
    }
  }

  return meta;
}

function pickMeta(meta, keys) {
  for (const key of keys) {
    const value = meta.get(key.toLowerCase());

    if (value) {
      return value;
    }
  }

  return "";
}

function getHtmlTitle(htmlText) {
  const match = htmlText.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlText(match[1]) : "";
}

function readStructuredName(value) {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
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

function getJsonLdObjects(htmlText) {
  const objects = [];
  const scriptPattern = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(htmlText))) {
    try {
      const data = JSON.parse(match[1].trim());
      const items = Array.isArray(data) ? data : [data];

      items.forEach((item) => {
        if (item && item["@graph"] && Array.isArray(item["@graph"])) {
          objects.push(...item["@graph"]);
        } else if (item) {
          objects.push(item);
        }
      });
    } catch (error) {
      // Ignore malformed JSON-LD and continue with other metadata.
    }
  }

  return objects;
}

function getJsonLdField(objects, keys) {
  for (const object of objects) {
    for (const key of keys) {
      const value = object && object[key];

      if (value) {
        return value;
      }
    }
  }

  return "";
}

function cleanDate(dateText) {
  if (!dateText) {
    return "";
  }

  const parsedDate = new Date(dateText);
  return Number.isNaN(parsedDate.getTime()) ? sanitizeText(dateText, 100) : parsedDate.toISOString().slice(0, 10);
}

function extractHtmlDetailsFromText(htmlText, url) {
  const meta = getMetaMap(htmlText);
  const jsonLdObjects = getJsonLdObjects(htmlText);
  const jsonLdAuthors = readStructuredName(getJsonLdField(jsonLdObjects, ["author", "creator"]));
  const jsonLdPublisher = readStructuredName(getJsonLdField(jsonLdObjects, ["publisher"])).find(Boolean);
  const doi = extractDoi(
    pickMeta(meta, ["citation_doi", "dc.identifier", "DC.Identifier", "prism.doi", "doi"]) ||
    sanitizeText(getJsonLdField(jsonLdObjects, ["doi", "identifier", "sameAs", "url"])) ||
    htmlText.slice(0, HTML_METADATA_BYTES)
  );
  const title = pickMeta(meta, ["og:title", "twitter:title", "citation_title"]) ||
    sanitizeText(getJsonLdField(jsonLdObjects, ["headline", "name"])) ||
    getHtmlTitle(htmlText);
  const website = pickMeta(meta, ["og:site_name", "application-name", "publisher"]) || getWebsiteFromUrl(url);
  const journalName = pickMeta(meta, ["citation_journal_title", "prism.publicationName"]);

  return sanitizeSourceDetails({
    sourceType: journalName ? "journal" : "website",
    title,
    website,
    publisher: pickMeta(meta, ["citation_publisher", "publisher", "article:publisher"]) || jsonLdPublisher || "",
    journalName,
    volume: pickMeta(meta, ["citation_volume", "prism.volume"]),
    issue: pickMeta(meta, ["citation_issue", "prism.number"]),
    pages: [
      pickMeta(meta, ["citation_firstpage", "prism.startingPage"]),
      pickMeta(meta, ["citation_lastpage", "prism.endingPage"])
    ].filter(Boolean).join("-"),
    url: doi || url,
    author: pickMeta(meta, ["citation_author", "author", "article:author", "article:author:name", "dc.creator", "DC.Creator"]) ||
      jsonLdAuthors.join("; "),
    publishedDate: cleanDate(
      pickMeta(meta, [
        "citation_publication_date",
        "citation_date",
        "article:published_time",
        "og:published_time",
        "date",
        "dc.date",
        "DC.Date",
        "prism.publicationDate",
        "pubdate",
        "publishdate",
        "publish-date",
        "timestamp",
        "datePublished"
      ]) ||
      sanitizeText(getJsonLdField(jsonLdObjects, ["datePublished", "dateCreated"]), 100)
    ),
    accessDate: new Date().toISOString().slice(0, 10)
  });
}

async function fetchLimitedText(url, maxBytes, headers = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers,
      credentials: "omit",
      redirect: "follow",
      referrerPolicy: "no-referrer",
      signal: controller.signal
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(`Metadata request failed with status ${response.status}.`);
    }

    if (!response.body) {
      const buffer = await response.arrayBuffer();
      return {
        text: new TextDecoder("latin1").decode(buffer.slice(0, maxBytes)),
        contentType: response.headers.get("content-type") || ""
      };
    }

    const reader = response.body.getReader();
    const chunks = [];
    let totalLength = 0;

    while (totalLength < maxBytes) {
      const { done, value } = await reader.read();

      if (done || !value) {
        break;
      }

      const remainingBytes = maxBytes - totalLength;
      const chunk = value.byteLength > remainingBytes ? value.slice(0, remainingBytes) : value;
      chunks.push(chunk);
      totalLength += chunk.byteLength;
    }

    try {
      await reader.cancel();
    } catch (error) {
      // The stream may already be closed.
    }

    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach((chunk) => {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    });

    return {
      text: new TextDecoder("latin1").decode(buffer),
      contentType: response.headers.get("content-type") || ""
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function findPdfInfoValue(pdfText, key) {
  const pattern = new RegExp(`/${key}\\s*(\\((?:\\\\.|[^\\\\)])*\\)|<[^>]+>)`, "i");
  const match = pdfText.match(pattern);
  return match ? decodePdfString(match[1]) : "";
}

function findXmpValue(pdfText, tagName) {
  const listPattern = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<rdf:li[^>]*>([\\s\\S]*?)<\\/rdf:li>[\\s\\S]*?<\\/${tagName}>`, "i");
  const listMatch = pdfText.match(listPattern);

  if (listMatch) {
    return decodeXmlText(listMatch[1]);
  }

  const simplePattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const simpleMatch = pdfText.match(simplePattern);
  return simpleMatch ? decodeXmlText(simpleMatch[1]) : "";
}

function cleanPdfDate(value) {
  const cleanValue = sanitizeText(value, 100).replace(/^D:/, "");
  const compactMatch = cleanValue.match(/^(\d{4})(\d{2})?(\d{2})?/);

  if (compactMatch) {
    return [
      compactMatch[1],
      compactMatch[2] || "01",
      compactMatch[3] || "01"
    ].join("-");
  }

  const parsedDate = new Date(cleanValue);
  return Number.isNaN(parsedDate.getTime()) ? cleanValue : parsedDate.toISOString().slice(0, 10);
}

function extractPdfDetailsFromText(pdfText, url, fallbackTitle) {
  const title = findXmpValue(pdfText, "dc:title") || findPdfInfoValue(pdfText, "Title") || fallbackTitle;
  const author = findXmpValue(pdfText, "dc:creator") || findPdfInfoValue(pdfText, "Author");
  const publisher = findXmpValue(pdfText, "dc:publisher") ||
    findPdfInfoValue(pdfText, "Publisher");
  const doi = extractDoi(
    findXmpValue(pdfText, "dc:identifier") ||
    findPdfInfoValue(pdfText, "doi") ||
    pdfText.slice(0, PDF_METADATA_BYTES)
  );
  const publishedDate = cleanPdfDate(
    findXmpValue(pdfText, "dc:date") ||
    findXmpValue(pdfText, "xmp:CreateDate") ||
    findXmpValue(pdfText, "xmp:ModifyDate") ||
    findPdfInfoValue(pdfText, "CreationDate") ||
    findPdfInfoValue(pdfText, "ModDate")
  );

  return sanitizeSourceDetails({
    sourceType: "pdf",
    title: cleanPdfTitle(title, url),
    website: getWebsiteFromUrl(url),
    publisher,
    journalName: "",
    volume: "",
    issue: "",
    pages: "",
    url: doi || url,
    author,
    publishedDate,
    accessDate: new Date().toISOString().slice(0, 10)
  });
}

async function fetchPdfText(url) {
  const result = await fetchLimitedText(url, PDF_METADATA_BYTES, {
    Range: `bytes=0-${PDF_METADATA_BYTES - 1}`
  });

  return result.text;
}

async function extractPdfDetails(url, fallbackTitle = "") {
  const safeUrl = sanitizeUrl(url);

  if (!safeUrl || !isPdfUrl(safeUrl)) {
    return null;
  }

  const fallbackDetails = sanitizeSourceDetails({
    sourceType: "pdf",
    title: cleanPdfTitle(fallbackTitle, safeUrl),
    website: getWebsiteFromUrl(safeUrl),
    publisher: "",
    journalName: "",
    volume: "",
    issue: "",
    pages: "",
    url: safeUrl,
    author: "",
    publishedDate: "",
    accessDate: new Date().toISOString().slice(0, 10)
  });

  try {
    return extractPdfDetailsFromText(await fetchPdfText(safeUrl), safeUrl, fallbackDetails.title);
  } catch (error) {
    console.warn("[AutoCite] Could not read PDF metadata.", error);
    return fallbackDetails;
  }
}

async function scanUrlDetails(url) {
  const safeUrl = sanitizeUrl(url);

  if (!safeUrl) {
    return null;
  }

  if (isPdfUrl(safeUrl)) {
    return extractPdfDetails(safeUrl);
  }

  try {
    const result = await fetchLimitedText(safeUrl, HTML_METADATA_BYTES, {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.1"
    });

    if (/application\/pdf/i.test(result.contentType)) {
      return extractPdfDetails(safeUrl);
    }

    return extractHtmlDetailsFromText(result.text, safeUrl);
  } catch (error) {
    console.warn("[AutoCite] Could not scan URL metadata.", error);
    return sanitizeSourceDetails({
      sourceType: "website",
      title: "",
      website: getWebsiteFromUrl(safeUrl),
      publisher: "",
      journalName: "",
      volume: "",
      issue: "",
      pages: "",
      url: safeUrl,
      author: "",
      publishedDate: "",
      accessDate: new Date().toISOString().slice(0, 10)
    });
  }
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

function getBrowserBrand() {
  const userAgentData = self.navigator && self.navigator.userAgentData;
  const brands = userAgentData && Array.isArray(userAgentData.brands) ? userAgentData.brands : [];
  const brandNames = brands.map((brand) => String(brand.brand || "").toLowerCase()).join(" ");
  const userAgent = String(self.navigator && self.navigator.userAgent || "").toLowerCase();
  const browserText = `${brandNames} ${userAgent}`;

  if (browserText.includes("edg")) {
    return "Microsoft Edge";
  }

  if (browserText.includes("opr") || browserText.includes("opera")) {
    return "Opera";
  }

  if (browserText.includes("brave")) {
    return "Brave";
  }

  if (browserText.includes("chrome") || browserText.includes("chromium")) {
    return "Chromium";
  }

  return "this Chromium browser";
}

function canUseSidePanel() {
  return Boolean(chrome.sidePanel && typeof chrome.sidePanel.open === "function");
}

function getSidebarUrl(tabId) {
  const query = typeof tabId === "number" ? `?tabId=${encodeURIComponent(String(tabId))}` : "";
  return chrome.runtime.getURL(`sidebar.html${query}`);
}

async function openFallbackSidebarWindow(tab) {
  if (!tab || typeof tab.id !== "number" || !chrome.windows || typeof chrome.windows.create !== "function") {
    console.error("[AutoCite] Sidebar window fallback is unavailable in this browser.");
    return false;
  }

  const width = 430;
  const height = 760;
  try {
    if (typeof fallbackSidebarWindowId === "number" && chrome.windows.remove) {
      chrome.windows.remove(fallbackSidebarWindowId, () => {
        const ignoredError = chrome.runtime.lastError;
      });
    }

    const sidebarWindow = await chrome.windows.create({
      url: getSidebarUrl(tab.id),
      type: "popup",
      width,
      height,
      focused: true
    });

    fallbackSidebarWindowId = sidebarWindow && typeof sidebarWindow.id === "number" ? sidebarWindow.id : null;
    fallbackSidebarTabId = tab.id;
    await injectContentScript(tab);
    await setTabSidebarState(tab.id, SIDEBAR_STATE_OPEN);
    notifyActiveTabChanged(tab);
    console.info(`[AutoCite] Opened AutoCite in a popup window because the Side Panel API is unavailable in ${getBrowserBrand()}.`);
    return true;
  } catch (error) {
    console.error("[AutoCite] Failed to open AutoCite fallback window.", error);
    return false;
  }
}

async function pingContentScript(tabId) {
  if (typeof tabId !== "number") {
    return false;
  }

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "AUTOCITE_PING" }, (response) => {
      const ignoredError = chrome.runtime.lastError;
      resolve(Boolean(response && response.ready));
    });
  });
}

async function injectContentScript(tab) {
  if (!canInjectIntoTab(tab)) {
    return false;
  }

  const alreadyInjected = await pingContentScript(tab.id);

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

function getTabSidebarState(tabId) {
  return tabSidebarStates.get(tabId) || globalSidebarState || SIDEBAR_STATE_CLOSED;
}

function sendStateToTab(tabId, sidebarState) {
  if (typeof tabId !== "number") {
    return;
  }

  chrome.tabs.sendMessage(tabId, {
    type: "AUTOCITE_SET_STATE",
    sidebarState
  }, () => {
    const ignoredError = chrome.runtime.lastError;
  });
}

async function setTabSidebarState(tabId, sidebarState) {
  globalSidebarState = sidebarState;

  if (typeof tabId === "number") {
    tabSidebarStates.set(tabId, sidebarState);
    sendStateToTab(tabId, sidebarState);
  }

  await chrome.storage.local.set({ [SIDEBAR_STATE_KEY]: sidebarState });
}

async function getActiveTab(tabId = null) {
  if (typeof tabId === "number" && chrome.tabs && chrome.tabs.get) {
    try {
      return await chrome.tabs.get(tabId);
    } catch (error) {
      return null;
    }
  }

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return activeTab || null;
  } catch (error) {
    return null;
  }
}

async function getMessageTab(message, sender) {
  if (message && typeof message.tabId === "number") {
    return { id: message.tabId };
  }

  if (sender && sender.tab) {
    return sender.tab;
  }

  return getActiveTab();
}

async function openAutoCiteSidebar(tab) {
  if (!tab || typeof tab.id !== "number") {
    return false;
  }

  if (!canUseSidePanel()) {
    return openFallbackSidebarWindow(tab);
  }

  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    await injectContentScript(tab);
    await setTabSidebarState(tab.id, SIDEBAR_STATE_OPEN);
    notifyActiveTabChanged(tab);
    return true;
  } catch (error) {
    console.warn("[AutoCite] Failed to open native side panel; trying popup fallback.", error);
    return openFallbackSidebarWindow(tab);
  }
}

async function connectAutoCiteToTab(tab) {
  if (!tab || typeof tab.id !== "number") {
    return false;
  }

  const connected = await injectContentScript(tab);

  if (connected) {
    await setTabSidebarState(tab.id, SIDEBAR_STATE_OPEN);
  }

  notifyActiveTabChanged(tab);
  return connected;
}

async function closeAutoCiteSidebar(tab, { dismissed = false } = {}) {
  try {
    const sidebarState = dismissed ? SIDEBAR_STATE_DISMISSED : SIDEBAR_STATE_CLOSED;

    await setTabSidebarState(tab && tab.id, sidebarState);
    chrome.runtime.sendMessage({ type: "AUTOCITE_CLOSE_SIDEBAR" }, () => {
      const ignoredError = chrome.runtime.lastError;
    });

    if (typeof fallbackSidebarWindowId === "number" && chrome.windows && chrome.windows.remove) {
      chrome.windows.remove(fallbackSidebarWindowId, () => {
        const ignoredError = chrome.runtime.lastError;
      });
      fallbackSidebarWindowId = null;
      fallbackSidebarTabId = null;
    }

    return true;
  } catch (error) {
    console.error("[AutoCite] Failed to close sidebar.", error);
    return false;
  }
}

async function toggleAutoCiteSidebar(tab) {
  if (!tab || typeof tab.id !== "number") {
    return false;
  }

  if (getTabSidebarState(tab.id) === SIDEBAR_STATE_OPEN) {
    return closeAutoCiteSidebar(tab);
  }

  return openAutoCiteSidebar(tab);
}

async function handleActionClicked(tab) {
  if (!tab || typeof tab.id !== "number") {
    return false;
  }

  if (globalSidebarState === SIDEBAR_STATE_OPEN) {
    if (await pingContentScript(tab.id)) {
      return closeAutoCiteSidebar(tab);
    }

    return connectAutoCiteToTab(tab);
  }

  return openAutoCiteSidebar(tab);
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

async function getActiveTabContext(tab = null, tabId = null) {
  const activeTab = tab || await getActiveTab(tabId);

  if (!activeTab || typeof activeTab.id !== "number") {
    return {
      connected: false,
      canAccess: false,
      reason: "No active tab is available."
    };
  }

  const rawTabUrl = activeTab.url || "";
  const tabUrl = sanitizeUrl(rawTabUrl);
  const looksLikeRestrictedPage = /^(chrome|edge|brave|vivaldi|opera|about):/i.test(rawTabUrl) ||
    /^https:\/\/chrome\.google\.com\/webstore/i.test(rawTabUrl) ||
    /^https:\/\/chromewebstore\.google\.com\//i.test(rawTabUrl);
  const mayNeedPermission = !rawTabUrl || !tabUrl;
  const isWebPage = canInjectIntoTab(activeTab);
  const context = {
    tabId: activeTab.id,
    title: sanitizeText(activeTab.title || ""),
    url: tabUrl,
    hostname: getWebsiteFromUrl(tabUrl),
    canAccess: isWebPage || mayNeedPermission,
    connected: false,
    reason: isWebPage || mayNeedPermission
      ? "Select Connect or click the AutoCite toolbar icon to use this tab."
      : "AutoCite can cite regular http and https pages."
  };

  if (looksLikeRestrictedPage) {
    context.canAccess = false;
    context.reason = "AutoCite cannot access this browser page. You can still enter details manually.";
    return context;
  }

  if (!isWebPage) {
    return context;
  }

  context.connected = await pingContentScript(activeTab.id);
  context.reason = context.connected ? "" : "Select Connect or click the AutoCite toolbar icon to use this tab.";
  return context;
}

function notifyActiveTabChanged(tab = null) {
  getActiveTabContext(tab).then((activeTabContext) => {
    chrome.runtime.sendMessage({
      type: "AUTOCITE_ACTIVE_TAB_CHANGED",
      activeTabContext
    }, () => {
      const ignoredError = chrome.runtime.lastError;
    });
  });
}

chrome.action.onClicked.addListener((tab) => {
  handleActionClicked(tab);
});

if (chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    tabSidebarStates.delete(tabId);

    if (fallbackSidebarTabId === tabId) {
      fallbackSidebarTabId = null;
      fallbackSidebarWindowId = null;
    }
  });
}

if (chrome.windows && chrome.windows.onRemoved) {
  chrome.windows.onRemoved.addListener((windowId) => {
    if (fallbackSidebarWindowId === windowId) {
      const closedTabId = fallbackSidebarTabId;
      fallbackSidebarWindowId = null;
      fallbackSidebarTabId = null;
      setTabSidebarState(closedTabId, SIDEBAR_STATE_CLOSED);
    }
  });
}

if (chrome.tabs && chrome.tabs.onActivated) {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      const ignoredError = chrome.runtime.lastError;

      if (globalSidebarState === SIDEBAR_STATE_OPEN && tab) {
        sendStateToTab(tab.id, SIDEBAR_STATE_OPEN);
        notifyActiveTabChanged(tab);
      }
    });
  });
}

if (chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && globalSidebarState === SIDEBAR_STATE_OPEN && tab && tab.active) {
      sendStateToTab(tabId, SIDEBAR_STATE_OPEN);
      notifyActiveTabChanged(tab);
    }
  });
}

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

  if (message.type === "CLOSE_AUTOCITE_SIDEBAR") {
    const closeCurrentSidebar = async () => {
      const tab = await getMessageTab(message, sender);
      return closeAutoCiteSidebar(tab, { dismissed: message.dismissed === true });
    };

    closeCurrentSidebar().then((closed) => {
      sendResponse({ closed });
    });

    return true;
  }

  if (message.type === "AUTOCITE_SIDEBAR_STATE_CHANGED") {
    const updateCurrentSidebar = async () => {
      const tab = await getMessageTab(message, sender);
      const sidebarState = VALID_SIDEBAR_STATES.has(message.sidebarState) ? message.sidebarState : SIDEBAR_STATE_CLOSED;
      await setTabSidebarState(tab && tab.id, sidebarState);
      return true;
    };

    updateCurrentSidebar().then((updated) => {
      sendResponse({ updated });
    });

    return true;
  }

  if (message.type === "EXTRACT_PDF_DETAILS") {
    extractPdfDetails(message.url, message.title).then((sourceDetails) => {
      sendResponse({ sourceDetails });
    });

    return true;
  }

  if (message.type === "SCAN_URL_DETAILS") {
    scanUrlDetails(message.url).then((sourceDetails) => {
      sendResponse({ sourceDetails });
    });

    return true;
  }

  if (message.type === "GET_ACTIVE_TAB_CONTEXT") {
    getActiveTabContext(null, message.tabId).then((activeTabContext) => {
      sendResponse({ activeTabContext });
    });

    return true;
  }

  if (message.type === "USE_ACTIVE_TAB") {
    getActiveTab(message.tabId).then(async (tab) => {
      const connected = await connectAutoCiteToTab(tab);
      const activeTabContext = await getActiveTabContext(tab);
      sendResponse({ connected, activeTabContext });
    });

    return true;
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
