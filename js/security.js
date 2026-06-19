// Security helpers for normalizing untrusted webpage and stored data.
(() => {

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

window.AutoCiteSecurity = {
  sanitizeText,
  sanitizeCopiedText,
  sanitizeUrl,
  sanitizeSourceDetails,
  sanitizeCopiedSource
};
})();
