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
const CROSSREF_WORKS_API = "https://api.crossref.org/works";

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

function mergeSourceDetails(baseDetails, overrideDetails) {
  const base = sanitizeSourceDetails(baseDetails);
  const override = sanitizeSourceDetails(overrideDetails);

  return sanitizeSourceDetails({
    ...base,
    ...Object.fromEntries(Object.entries(override).filter(([, value]) => Boolean(value))),
    sourceType: override.sourceType || base.sourceType || "website",
    accessDate: base.accessDate || override.accessDate || new Date().toISOString().slice(0, 10)
  });
}

function isPdfUrl(value) {
  return /\.pdf(?:[?#]|$)/i.test(value || "");
}

function isSecureWebUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch (error) {
    return false;
  }
}

function getArticleUrlFromPdfUrl(value) {
  const safeUrl = sanitizeUrl(value);

  if (!safeUrl) {
    return "";
  }

  try {
    const parsedUrl = new URL(safeUrl);

    if (/\.pdf$/i.test(parsedUrl.pathname)) {
      parsedUrl.pathname = parsedUrl.pathname.replace(/\.pdf$/i, "");
      return parsedUrl.href;
    }
  } catch (error) {
    return "";
  }

  return "";
}

function hasUsefulCitationDetails(details) {
  const source = sanitizeSourceDetails(details);
  return Boolean(source.title && (source.author || source.publisher || source.journalName || source.publishedDate));
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

    if (key && content) {
      const values = meta.get(key) || [];
      values.push(content);
      meta.set(key, values);
    }
  }

  return meta;
}

function getMetaValues(meta, key) {
  const values = meta.get(key.toLowerCase());

  if (!values) {
    return [];
  }

  return Array.isArray(values) ? values : [values];
}

function pickMeta(meta, keys) {
  for (const key of keys) {
    const value = getMetaValues(meta, key).find(Boolean);

    if (value) {
      return value;
    }
  }

  return "";
}

function pickAllMeta(meta, keys) {
  const values = [];

  keys.forEach((key) => {
    values.push(...getMetaValues(meta, key));
  });

  return values.filter(Boolean);
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

function getCrossrefDate(dateParts) {
  const parts = Array.isArray(dateParts && dateParts["date-parts"]) ? dateParts["date-parts"][0] : null;

  if (!Array.isArray(parts) || !parts.length) {
    return "";
  }

  return parts.filter(Boolean).join("-");
}

function getCrossrefAuthorName(author) {
  if (!author || typeof author !== "object") {
    return "";
  }

  return [author.given, author.family].filter(Boolean).join(" ") || author.name || "";
}

function detailsFromCrossrefWork(work) {
  if (!work || typeof work !== "object") {
    return null;
  }

  const title = Array.isArray(work.title) ? work.title.find(Boolean) : work.title;
  const journalName = Array.isArray(work["container-title"]) ? work["container-title"].find(Boolean) : work["container-title"];
  const publishedDate = getCrossrefDate(work.published) ||
    getCrossrefDate(work["published-print"]) ||
    getCrossrefDate(work["published-online"]) ||
    getCrossrefDate(work.created);
  const doi = cleanDoi(work.DOI || work.doi || "");
  const authors = Array.isArray(work.author) ? work.author.map(getCrossrefAuthorName).filter(Boolean) : [];

  return sanitizeSourceDetails({
    sourceType: journalName ? "journal" : "pdf",
    title: sanitizeText(title),
    website: "",
    publisher: sanitizeText(work.publisher),
    journalName: sanitizeText(journalName),
    volume: sanitizeText(work.volume, 100),
    issue: sanitizeText(work.issue, 100),
    pages: sanitizeText(work.page, 100),
    url: doi || sanitizeUrl(work.URL),
    author: authors.join("; "),
    publishedDate,
    accessDate: new Date().toISOString().slice(0, 10)
  });
}

function normalizeLookupTitle(title) {
  return sanitizeText(title, 500)
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTitleSimilarity(leftTitle, rightTitle) {
  const leftWords = new Set(normalizeLookupTitle(leftTitle).split(" ").filter((word) => word.length > 2));
  const rightWords = new Set(normalizeLookupTitle(rightTitle).split(" ").filter((word) => word.length > 2));

  if (!leftWords.size || !rightWords.size) {
    return 0;
  }

  const shared = Array.from(leftWords).filter((word) => rightWords.has(word)).length;
  return shared / Math.max(leftWords.size, rightWords.size);
}

async function fetchCrossrefJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.warn("[AutoCite] Academic metadata lookup failed.", error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function lookupCrossrefByDoi(doi) {
  const cleanValue = cleanDoi(doi);

  if (!cleanValue) {
    return null;
  }

  const data = await fetchCrossrefJson(`${CROSSREF_WORKS_API}/${encodeURIComponent(cleanValue)}`);
  return detailsFromCrossrefWork(data && data.message);
}

async function lookupCrossrefByTitle(title, expectedDetails = {}) {
  const cleanTitle = sanitizeText(title, 500);

  if (!cleanTitle || cleanTitle.split(/\s+/).length < 4) {
    return null;
  }

  const params = new URLSearchParams({
    "query.title": cleanTitle,
    rows: "5"
  });
  const data = await fetchCrossrefJson(`${CROSSREF_WORKS_API}?${params.toString()}`);
  const works = data && data.message && Array.isArray(data.message.items) ? data.message.items : [];
  const expectedYear = (sanitizeText(expectedDetails.publishedDate, 100).match(/\b(19|20)\d{2}\b/) || [])[0];

  let bestWork = null;
  let bestScore = 0;

  works.forEach((work) => {
    const workTitle = Array.isArray(work.title) ? work.title.find(Boolean) : work.title;
    const similarity = getTitleSimilarity(cleanTitle, workTitle);
    const workYear = (getCrossrefDate(work.published) || getCrossrefDate(work["published-print"]) || getCrossrefDate(work["published-online"])).match(/\b(19|20)\d{2}\b/);
    const yearBonus = expectedYear && workYear && workYear[0] === expectedYear ? 0.12 : 0;
    const authorBonus = expectedDetails.author && Array.isArray(work.author) && work.author.some((author) => {
      return normalizeLookupTitle(expectedDetails.author).includes(normalizeLookupTitle(author.family || author.name || ""));
    }) ? 0.08 : 0;
    const score = similarity + yearBonus + authorBonus;

    if (score > bestScore) {
      bestScore = score;
      bestWork = work;
    }
  });

  return bestScore >= 0.55 ? detailsFromCrossrefWork(bestWork) : null;
}

async function lookupAcademicDetails(details) {
  const source = sanitizeSourceDetails(details);
  const doiDetails = source.url && extractDoi(source.url) ? await lookupCrossrefByDoi(source.url) : null;

  if (doiDetails) {
    return mergeSourceDetails(source, doiDetails);
  }

  const titleDetails = await lookupCrossrefByTitle(source.title, source);
  return titleDetails ? mergeSourceDetails(source, titleDetails) : source;
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
  const metaAuthors = pickAllMeta(meta, [
    "citation_author",
    "author",
    "article:author",
    "article:author:name",
    "byl",
    "dc.creator",
    "DC.Creator"
  ]);
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
    author: metaAuthors.join("; ") ||
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
        "datePublished",
        "datepublished",
        "article:modified_time",
        "og:updated_time"
      ]) ||
      sanitizeText(getJsonLdField(jsonLdObjects, ["datePublished", "dateCreated", "dateModified"]), 100)
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
        contentType: response.headers.get("content-type") || "",
        responseUrl: response.url || url
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
      contentType: response.headers.get("content-type") || "",
      responseUrl: response.url || url
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

function getReadablePdfLines(pdfText) {
  const literalText = Array.from(pdfText.matchAll(/\((?:\\.|[^\\)]){4,}\)/g))
    .map((match) => decodePdfString(match[0]));
  const textOperatorLines = getPdfTextOperatorLines(pdfText);
  const plainText = pdfText
    .replace(/[^\x20-\x7E\n\r]+/g, " ")
    .split(/[\r\n]+/)
    .map((line) => sanitizeText(line, 220))
    .filter((line) => /[A-Za-z]{3}/.test(line));

  return [...textOperatorLines, ...literalText, ...plainText]
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => isUsefulPdfLine(line))
    .slice(0, 140);
}

async function getReadablePdfLinesWithInflatedStreams(pdfText) {
  const inflatedText = await getInflatedPdfStreamText(pdfText);
  const inflatedLines = inflatedText ? getReadablePdfLines(inflatedText) : [];
  const seen = new Set();
  const candidateLines = inflatedLines.length
    ? inflatedLines
    : (/\/FlateDecode\b/i.test(pdfText) ? [] : getReadablePdfLines(pdfText));

  return candidateLines
    .filter((line) => {
      const key = line.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 180);
}

async function getInflatedPdfStreamText(pdfText) {
  if (typeof DecompressionStream !== "function" || !/\/FlateDecode\b/i.test(pdfText)) {
    return "";
  }

  const chunks = [];
  const streamPattern = /<<(?:[\s\S]{0,1200}?\/FlateDecode[\s\S]{0,1200}?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/gi;
  let match;

  while ((match = streamPattern.exec(pdfText)) && chunks.length < 8) {
    const inflated = await inflatePdfStreamText(match[1]);

    if (inflated && getPdfTextOperatorLines(inflated).some(isUsefulPdfLine)) {
      chunks.push(inflated);
    }
  }

  return chunks.join("\n");
}

async function inflatePdfStreamText(streamText) {
  try {
    const bytes = new Uint8Array(streamText.length);

    for (let index = 0; index < streamText.length; index += 1) {
      bytes[index] = streamText.charCodeAt(index) & 0xff;
    }

    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
    const buffer = await new Response(stream).arrayBuffer();
    return new TextDecoder("latin1").decode(buffer);
  } catch (error) {
    return "";
  }
}

function getPdfTextOperatorLines(pdfText) {
  const firstPageText = getFirstPagePdfText(pdfText);
  const lines = [];
  const textBlocks = firstPageText.match(/BT[\s\S]*?ET/g) || [];

  textBlocks.forEach((block) => {
    const values = [];
    const arrayPattern = /\[((?:\s*(?:\((?:\\.|[^\\)])*\)|<[0-9a-f\s]+>|-?\d+(?:\.\d+)?)\s*)+)\]\s*TJ/gim;
    const stringPattern = /(\((?:\\.|[^\\)])*\)|<[0-9a-f\s]+>)\s*(?:Tj|'|")/gim;
    let match;

    while ((match = arrayPattern.exec(block))) {
      values.push(getPdfStringTokens(match[1]).map(decodePdfString).join(""));
    }

    while ((match = stringPattern.exec(block))) {
      values.push(decodePdfString(match[1]));
    }

    const joined = values.join(" ").replace(/\s+/g, " ").trim();

    if (joined) {
      lines.push(joined);
    }
  });

  return lines;
}

function getFirstPagePdfText(pdfText) {
  const secondPageMatch = pdfText.slice(1000).match(/\/Type\s*\/Page\b/i);
  const endIndex = secondPageMatch ? secondPageMatch.index + 1000 : Math.min(pdfText.length, PDF_METADATA_BYTES);
  return pdfText.slice(0, Math.max(endIndex, Math.min(pdfText.length, 350000)));
}

function getPdfStringTokens(value) {
  return Array.from(String(value || "").matchAll(/\((?:\\.|[^\\)])*\)|<[0-9a-f\s]+>/gi)).map((match) => match[0]);
}

function isUsefulPdfLine(line) {
  return line.length >= 4 &&
    line.length <= 260 &&
    /[A-Za-z]{3}/.test(line) &&
    hasReadablePdfTextQuality(line) &&
    !/<<|>>|\/(?:Type|Subtype|BaseFont|Encoding|FontDescriptor|FirstChar|LastChar|Widths)\b/i.test(line) &&
    !/^(obj|endobj|stream|endstream|xref|trailer|startxref|\d+\s+\d+\s+obj)$/i.test(line) &&
    !/^\/(?:Type|Filter|Length|Subtype|Resources|Font|ProcSet)\b/i.test(line);
}

function hasReadablePdfTextQuality(line) {
  const value = String(line || "").trim();
  const naturalTextCharacters = (value.match(/[A-Za-z0-9\s.,;:!?'"()&/-]/g) || []).length;
  const letterCharacters = (value.match(/[A-Za-z]/g) || []).length;

  return Boolean(value) &&
    naturalTextCharacters / value.length >= 0.85 &&
    letterCharacters / value.length >= 0.45;
}

function isPdfImageBased(pdfText, lines) {
  return lines.length < 4 && /\/Subtype\s*\/Image\b/i.test(pdfText);
}

function isBadPdfMetadataTitle(title, url) {
  const cleanTitle = cleanPdfTitle(title, url).toLowerCase();
  const fileTitle = cleanPdfTitle("", url).toLowerCase();

  return !cleanTitle ||
    cleanTitle === fileTitle ||
    /^(untitled|document|article|full text|download|view|pdf|microsoft word|converted|main)$/i.test(cleanTitle) ||
    /\.(docx?|pptx?|xlsx?)$/i.test(cleanTitle);
}

function normalizePdfCandidateLine(line) {
  return sanitizeText(line, 260)
    .replace(/^\s*(title|paper|article)\s*[:.-]\s*/i, "")
    .replace(/\s*\|\s*.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSectionHeading(line) {
  return /^(abstract|summary|introduction|keywords?|references|contents|appendix|acknowledg|background|methods?|results?|discussion|conclusion)\b/i.test(line);
}

function isLikelyTitleLine(line) {
  const value = normalizePdfCandidateLine(line);
  const words = value.split(/\s+/).filter(Boolean);

  return words.length >= 4 &&
    words.length <= 28 &&
    /[A-Za-z]/.test(value) &&
    hasReadablePdfTextQuality(value) &&
    !isSectionHeading(value) &&
    !/\b(doi|issn|isbn|copyright|creative commons|received|accepted|published|volume|vol\.|issue|pages?|university|department|conference proceedings)\b/i.test(value) &&
    !/^https?:\/\//i.test(value);
}

function getLikelyPdfTitle(lines) {
  const stopIndex = lines.findIndex((line) => isSectionHeading(line));
  const titleLines = (stopIndex >= 0 ? lines.slice(0, stopIndex) : lines.slice(0, 28))
    .map(normalizePdfCandidateLine)
    .filter(Boolean);
  const candidates = titleLines.filter(isLikelyTitleLine);

  for (let index = 0; index < titleLines.length - 1; index += 1) {
    const combinedTitle = titleLines.slice(index, index + 3).join(" ");

    if (isLikelyTitleLine(combinedTitle)) {
      candidates.push(combinedTitle);
      break;
    }
  }

  if (!candidates.length) {
    return "";
  }

  const title = candidates.slice(0, 2).join(" ");
  return title.length <= 260 ? title : candidates[0];
}

function cleanAuthorLine(line) {
  return sanitizeText(line, 500)
    .replace(/^(by|authors?)[:\s]+/i, "")
    .replace(/\b(?:orcid|email|e-mail|corresponding author)\b.*$/i, "")
    .replace(/\s*\d+(?:,\d+)*\s*/g, " ")
    .replace(/\s*[*,;]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyAuthorLine(line) {
  const value = cleanAuthorLine(line);
  const words = value.split(/\s+/).filter(Boolean);

  if (!value || words.length < 2 || words.length > 24 || isSectionHeading(value) || !hasReadablePdfTextQuality(value)) {
    return false;
  }

  if (/\b(abstract|university|department|institute|journal|conference|proceedings|copyright|doi|keywords?|received|accepted|published)\b/i.test(value)) {
    return false;
  }

  return /(?:,|\band\b|;|&)/i.test(value) ||
    /^[A-Z][A-Za-z'.-]+(?:\s+[A-Z]\.)?\s+[A-Z][A-Za-z'.-]+(?:\s*,\s*[A-Z][A-Za-z'.-]+(?:\s+[A-Z]\.)?\s+[A-Z][A-Za-z'.-]+)*$/.test(value);
}

function getLikelyPdfAuthor(lines, title) {
  const titleIndex = title ? lines.findIndex((line) => normalizePdfCandidateLine(line) === title || title.includes(normalizePdfCandidateLine(line))) : -1;
  const searchStart = titleIndex >= 0 ? titleIndex + 1 : 0;
  const abstractIndex = lines.findIndex((line, index) => index > searchStart && isSectionHeading(line));
  const authorLines = lines.slice(searchStart, abstractIndex >= 0 ? abstractIndex : searchStart + 12)
    .map(cleanAuthorLine)
    .filter(isLikelyAuthorLine);

  return authorLines[0] || "";
}

function getLikelyPdfJournal(lines) {
  return lines.find((line) => {
    return /\b(journal of|international journal|proceedings of|conference on|transactions on|symposium on|workshop on|lecture notes|arxiv|IEEE|ACM|Nature|Science)\b/i.test(line) &&
      !isLikelyTitleLine(line);
  }) || "";
}

function getLikelyPdfPublisher(lines) {
  return lines.find((line) => /\b(university|press|publisher|institute|association|department|school of|IEEE|ACM|Springer|Elsevier|Wiley|Taylor\s*&\s*Francis|SAGE|Nature Publishing|MDPI|Frontiers)\b/i.test(line)) || "";
}

function getLikelyPdfDate(pdfText, lines) {
  const priorityLine = lines.find((line) => /\b(published|publication|copyright|received|accepted|available online|proceedings)\b/i.test(line) && /\b(19|20)\d{2}\b/.test(line));
  const priorityMatch = priorityLine ? priorityLine.match(/\b(19|20)\d{2}(?:[-/](0?[1-9]|1[0-2])(?:[-/](0?[1-9]|[12]\d|3[01]))?)?\b/) : null;
  const dateMatch = priorityMatch || pdfText.match(/\b(19|20)\d{2}(?:[-/](0?[1-9]|1[0-2])(?:[-/](0?[1-9]|[12]\d|3[01]))?)?\b/);

  return dateMatch ? cleanDate(dateMatch[0]) : "";
}

function isBadPdfMetadataAuthor(author, titlePageAuthor) {
  const cleanAuthor = sanitizeText(author, 500);

  if (/^(smart|user|administrator|admin|owner|unknown|microsoft office|adobe acrobat)$/i.test(cleanAuthor)) {
    return true;
  }

  return Boolean(titlePageAuthor) && (!cleanAuthor || cleanAuthor.split(/\s+/).filter(Boolean).length < 2);
}

async function getPdfTitlePageHints(pdfText) {
  const lines = await getReadablePdfLinesWithInflatedStreams(pdfText);
  const title = getLikelyPdfTitle(lines);
  const author = getLikelyPdfAuthor(lines, title);
  const journalName = getLikelyPdfJournal(lines);
  const publisher = getLikelyPdfPublisher(lines);

  return {
    title,
    author,
    journalName,
    publisher,
    publishedDate: getLikelyPdfDate(pdfText, lines),
    imageBased: isPdfImageBased(pdfText, lines)
  };
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

async function extractPdfDetailsFromText(pdfText, url, fallbackTitle) {
  const titlePageHints = await getPdfTitlePageHints(pdfText);
  const metadataTitle = findXmpValue(pdfText, "dc:title") || findPdfInfoValue(pdfText, "Title");
  const title = isBadPdfMetadataTitle(metadataTitle, url) ? titlePageHints.title || fallbackTitle : metadataTitle;
  const metadataAuthor = findXmpValue(pdfText, "dc:creator") || findPdfInfoValue(pdfText, "Author");
  const author = isBadPdfMetadataAuthor(metadataAuthor, titlePageHints.author) ? titlePageHints.author : metadataAuthor;
  const publisher = findXmpValue(pdfText, "dc:publisher") ||
    findPdfInfoValue(pdfText, "Publisher");
  const doi = extractDoi(
    findXmpValue(pdfText, "dc:identifier") ||
    findPdfInfoValue(pdfText, "doi") ||
    findPdfInfoValue(pdfText, "Subject") ||
    findPdfInfoValue(pdfText, "Keywords") ||
    titlePageHints.title ||
    titlePageHints.journalName ||
    pdfText.slice(0, PDF_METADATA_BYTES)
  );
  const publishedDate = cleanPdfDate(
    findXmpValue(pdfText, "dc:date") ||
    findXmpValue(pdfText, "xmp:CreateDate") ||
    findXmpValue(pdfText, "xmp:ModifyDate") ||
    findPdfInfoValue(pdfText, "CreationDate") ||
    findPdfInfoValue(pdfText, "ModDate")
  );

  const extractedDetails = sanitizeSourceDetails({
    sourceType: titlePageHints.journalName ? "journal" : "pdf",
    title: cleanPdfTitle(title, url),
    website: getWebsiteFromUrl(url),
    publisher: publisher || titlePageHints.publisher,
    journalName: titlePageHints.journalName,
    volume: "",
    issue: "",
    pages: "",
    url: doi || url,
    author: author || titlePageHints.author,
    publishedDate: publishedDate || titlePageHints.publishedDate,
    accessDate: new Date().toISOString().slice(0, 10)
  });

  return lookupAcademicDetails(extractedDetails);
}

async function fetchPdfText(url) {
  return fetchLimitedText(url, PDF_METADATA_BYTES, {
    Range: `bytes=0-${PDF_METADATA_BYTES - 1}`
  });
}

async function extractPdfDetails(url, fallbackTitle = "", options = {}) {
  const safeUrl = sanitizeUrl(url);
  const forcePdf = Boolean(options && options.forcePdf);

  if (!safeUrl || !isSecureWebUrl(safeUrl) || (!forcePdf && !isPdfUrl(safeUrl))) {
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
    const pdfResult = await fetchPdfText(safeUrl);
    const responseUrl = sanitizeUrl(pdfResult.responseUrl) || safeUrl;

    if (/text\/html|application\/xhtml\+xml/i.test(pdfResult.contentType) || /^\s*<!doctype html|^\s*<html\b/i.test(pdfResult.text)) {
      return lookupAcademicDetails(extractHtmlDetailsFromText(pdfResult.text, responseUrl));
    }

    const extractedDetails = await extractPdfDetailsFromText(pdfResult.text, responseUrl, fallbackDetails.title);

    if (!hasUsefulCitationDetails(extractedDetails)) {
      const articleUrl = getArticleUrlFromPdfUrl(safeUrl);

      if (articleUrl) {
        const articleDetails = await scanUrlDetails(articleUrl);

        if (hasUsefulCitationDetails(articleDetails)) {
          return articleDetails;
        }
      }
    }

    return extractedDetails;
  } catch (error) {
    console.warn("[AutoCite] Could not read PDF metadata.", error);
    return fallbackDetails;
  }
}

async function scanUrlDetails(url) {
  const safeUrl = sanitizeUrl(url);

  if (!safeUrl || !isSecureWebUrl(safeUrl)) {
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
      return extractPdfDetails(safeUrl, "", { forcePdf: true });
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

function isExtensionPageRequest(sender) {
  return Boolean(
    sender &&
    sender.id === chrome.runtime.id &&
    !sender.tab &&
    typeof sender.url === "string" &&
    sender.url.startsWith(chrome.runtime.getURL(""))
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
  const isBlobPdf = /^blob:/i.test(rawTabUrl) || /^blob:/i.test(activeTab.pendingUrl || "");
  const isLocalFile = /^file:/i.test(rawTabUrl);
  const looksLikeRestrictedPage = /^(chrome|edge|brave|vivaldi|opera|about):/i.test(rawTabUrl) ||
    /^https:\/\/chrome\.google\.com\/webstore/i.test(rawTabUrl) ||
    /^https:\/\/chromewebstore\.google\.com\//i.test(rawTabUrl);
  const mayNeedPermission = !rawTabUrl || !tabUrl;
  const isWebPage = canInjectIntoTab(activeTab);
  const context = {
    tabId: activeTab.id,
    title: sanitizeText(activeTab.title || ""),
    url: tabUrl,
    rawProtocol: (rawTabUrl.match(/^[a-z]+:/i) || [""])[0].toLowerCase(),
    isBlobPdf,
    isLocalFile,
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

  if (isBlobPdf || isLocalFile) {
    context.canAccess = false;
    context.reason = isBlobPdf
      ? "This PDF is opened as a browser blob. Open the original PDF URL if available, or enter the source details manually."
      : "AutoCite cannot read local file tabs directly. Enter the source details manually.";
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
    if (!isExtensionPageRequest(sender)) {
      return;
    }

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
    if (!isExtensionPageRequest(sender)) {
      return;
    }

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
    if (!isExtensionPageRequest(sender)) {
      return;
    }

    extractPdfDetails(message.url, message.title).then((sourceDetails) => {
      sendResponse({ sourceDetails });
    });

    return true;
  }

  if (message.type === "SCAN_URL_DETAILS") {
    if (!isExtensionPageRequest(sender)) {
      return;
    }

    scanUrlDetails(message.url).then((sourceDetails) => {
      sendResponse({ sourceDetails });
    });

    return true;
  }

  if (message.type === "LOOKUP_ACADEMIC_DETAILS") {
    if (!isExtensionPageRequest(sender)) {
      return;
    }

    lookupAcademicDetails(message.sourceDetails).then((sourceDetails) => {
      sendResponse({ sourceDetails });
    });

    return true;
  }

  if (message.type === "GET_ACTIVE_TAB_CONTEXT") {
    if (!isExtensionPageRequest(sender)) {
      return;
    }

    getActiveTabContext(null, message.tabId).then((activeTabContext) => {
      sendResponse({ activeTabContext });
    });

    return true;
  }

  if (message.type === "USE_ACTIVE_TAB") {
    if (!isExtensionPageRequest(sender)) {
      return;
    }

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
