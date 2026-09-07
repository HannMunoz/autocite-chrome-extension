// Additional common citation style formatters.
(() => {

function compactText(text) {
  return String(text || "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function ensurePeriod(text) {
  const value = compactText(text);
  return value && !/[.!?]$/.test(value) ? `${value}.` : value;
}

function getAuthorDateName(source, helpers, joiner = "&") {
  const authorText = helpers.getGeneralInTextContributor(source);
  return joiner === "and" ? authorText.replace(" & ", " and ") : authorText;
}

function getContainer(source) {
  return source.sourceType === "journal" ? source.journalName || "Untitled journal" : source.website || source.publisher || "";
}

function generateHarvard(source, helpers) {
  const author = helpers.formatChicagoContributorList(source) || helpers.getFallbackName(source);
  const year = helpers.getYear(source.publishedDate) || "n.d.";
  const title = source.title || "Untitled source";
  const url = helpers.normalizeDoiOrUrl(source.url);
  const accessed = source.accessDate && source.sourceType !== "book" ? `Available at: ${url} (Accessed: ${helpers.formatReadableDate(source.accessDate)}).` : url;
  let details = "";

  if (source.sourceType === "journal") {
    const volumeIssue = source.volume ? `${source.volume}${source.issue ? `(${source.issue})` : ""}` : "";
    details = `${source.journalName || "Untitled journal"}${volumeIssue ? `, ${volumeIssue}` : ""}${source.pages ? `, pp. ${source.pages}` : ""}. ${url}`;
  } else if (source.sourceType === "book") {
    details = `${source.publisher || ""}. ${url}`;
  } else {
    details = `${getContainer(source)}. ${accessed}`;
  }

  return {
    full: compactText(`${author} (${year}) ${ensurePeriod(title)} ${details}`),
    inText: `(${getAuthorDateName(source, helpers, "and")}, ${year})`
  };
}

function getNumericAuthors(source, helpers) {
  return helpers.formatNumericContributorList(source) || helpers.getFallbackName(source);
}

function getNumericDate(source, helpers) {
  const date = helpers.formatReadableDate(source.publishedDate);
  return date || helpers.getYear(source.publishedDate);
}

function generateIEEE(source, helpers) {
  const authors = getNumericAuthors(source, helpers);
  const title = source.title || "Untitled source";
  const url = helpers.normalizeDoiOrUrl(source.url);
  const year = helpers.getYear(source.publishedDate);
  let full = "";

  if (source.sourceType === "journal") {
    const volume = source.volume ? `vol. ${source.volume}` : "";
    const issue = source.issue ? `no. ${source.issue}` : "";
    const pages = source.pages ? `pp. ${source.pages}` : "";
    full = `${authors}, "${title}," ${source.journalName || "Untitled journal"}, ${[volume, issue, pages, year].filter(Boolean).join(", ")}. ${url}`;
  } else if (source.sourceType === "book") {
    full = `${authors}, ${ensurePeriod(title)} ${source.publisher || ""}, ${year}. ${url}`;
  } else {
    full = `${authors}, "${title}," ${getContainer(source)}, ${year}. [Online]. Available: ${url}`;
  }

  return {
    full: compactText(full),
    inText: "[#]"
  };
}

function generateVancouver(source, helpers) {
  const authors = getNumericAuthors(source, helpers);
  const title = source.title || "Untitled source";
  const url = helpers.normalizeDoiOrUrl(source.url);
  const date = getNumericDate(source, helpers);
  let full = "";

  if (source.sourceType === "journal") {
    const volumeIssue = source.volume ? `${source.volume}${source.issue ? `(${source.issue})` : ""}` : "";
    full = `${authors}. ${title}. ${source.journalName || "Untitled journal"}. ${helpers.getYear(source.publishedDate)};${volumeIssue}${source.pages ? `:${source.pages}` : ""}. ${url}`;
  } else if (source.sourceType === "book") {
    full = `${authors}. ${title}. ${source.publisher || ""}; ${helpers.getYear(source.publishedDate)}. ${url}`;
  } else {
    full = `${authors}. ${title} [Internet]. ${getContainer(source)}; ${date} [cited ${helpers.formatReadableDate(source.accessDate)}]. Available from: ${url}`;
  }

  return {
    full: compactText(full),
    inText: "(#)"
  };
}

function generateAMA(source, helpers) {
  const authors = getNumericAuthors(source, helpers);
  const title = source.title || "Untitled source";
  const url = helpers.normalizeDoiOrUrl(source.url);
  const year = helpers.getYear(source.publishedDate);
  let full = "";

  if (source.sourceType === "journal") {
    const volumeIssue = source.volume ? `${source.volume}${source.issue ? `(${source.issue})` : ""}` : "";
    full = `${authors}. ${title}. ${source.journalName || "Untitled journal"}. ${year};${volumeIssue}${source.pages ? `:${source.pages}` : ""}. ${url}`;
  } else if (source.sourceType === "book") {
    full = `${authors}. ${title}. ${source.publisher || ""}; ${year}. ${url}`;
  } else {
    full = `${authors}. ${title}. ${getContainer(source)}. Published ${year}. Accessed ${helpers.formatReadableDate(source.accessDate)}. ${url}`;
  }

  return {
    full: compactText(full),
    inText: "#"
  };
}

function generateTurabian(source, helpers) {
  const author = helpers.formatChicagoContributorList(source) || helpers.getFallbackName(source);
  const title = source.title || "Untitled source";
  const year = helpers.getYear(source.publishedDate) || "n.d.";
  const url = helpers.normalizeDoiOrUrl(source.url);
  let full = "";

  if (source.sourceType === "journal") {
    const volumeIssue = source.volume ? `${source.volume}${source.issue ? `, no. ${source.issue}` : ""}` : "";
    full = `${author}. "${title}." ${source.journalName || "Untitled journal"} ${volumeIssue}${source.pages ? `: ${source.pages}` : ""}. ${url}.`;
  } else if (source.sourceType === "book") {
    full = `${author}. ${ensurePeriod(title)} ${source.publisher || ""}, ${year}. ${url}`;
  } else {
    full = `${author}. "${title}." ${getContainer(source)}. ${helpers.formatReadableDate(source.publishedDate) || year}. ${url}.`;
  }

  return {
    full: compactText(full),
    inText: `(${getAuthorDateName(source, helpers, "and")} ${year})`
  };
}

function generateChicagoNotes(source, helpers) {
  const citation = generateTurabian(source, helpers);
  return {
    full: citation.full,
    inText: "#"
  };
}

window.AutoCiteAdditionalFormatters = {
  generateHarvard,
  generateIEEE,
  generateVancouver,
  generateAMA,
  generateTurabian,
  generateChicagoNotes
};
})();
