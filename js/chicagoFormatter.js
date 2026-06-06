// Chicago Author-Date website formatter.
(() => {

function generateChicago(source, helpers) {
  const authorText = helpers.formatChicagoContributorList(source);
  const primaryAuthor = helpers.getPrimaryAuthor(source.contributors);
  const organization = helpers.getOrganizationContributor(source.contributors);
  const author = authorText ? `${authorText}. ` : "";
  const title = source.title || "Untitled source";
  const website = source.website || "";
  const publisher = source.publisher && source.publisher !== website ? source.publisher : "";
  const year = helpers.getYear(source.publishedDate) || "n.d.";
  const publishedDate = helpers.formatReadableDate(source.publishedDate);
  const url = source.url || "";
  const authorForInText = primaryAuthor ? primaryAuthor.lastName : organization ? organization.organizationName : helpers.getShortTitle(title);

  return {
    full: `${author}${year}. "${title}." ${website}${publisher ? `. ${publisher}` : ""}${publishedDate ? `. ${publishedDate}.` : "."} ${url}.`.replace(/\s+/g, " ").trim(),
    inText: `(${authorForInText} ${year})`
  };
}

function getChicagoInText(source, helpers) {
  const year = helpers.getYear(source.publishedDate) || "n.d.";
  return `(${helpers.getGeneralInTextContributor(source)} ${year})`;
}

function generateChicagoPDF(source, helpers) {
  const author = helpers.formatChicagoContributorList(source);
  const year = helpers.getYear(source.publishedDate) || "n.d.";
  const publisher = source.publisher || "";
  const url = helpers.normalizeDoiOrUrl(source.url);

  return {
    full: `${author ? `${author}. ` : ""}${year}. ${source.title || "Untitled document"}. PDF. ${publisher}. ${url}.`.replace(/\s+/g, " ").trim(),
    inText: getChicagoInText(source, helpers)
  };
}

function generateChicagoBook(source, helpers) {
  const author = helpers.formatChicagoContributorList(source);
  const year = helpers.getYear(source.publishedDate) || "n.d.";
  const publisher = source.publisher || "";
  const url = helpers.normalizeDoiOrUrl(source.url);

  return {
    full: `${author ? `${author}. ` : ""}${year}. ${source.title || "Untitled book"}. ${publisher}. ${url}.`.replace(/\s+/g, " ").trim(),
    inText: getChicagoInText(source, helpers)
  };
}

function generateChicagoJournal(source, helpers) {
  const author = helpers.formatChicagoContributorList(source);
  const year = helpers.getYear(source.publishedDate) || "n.d.";
  const volumeIssue = source.volume ? `${source.volume}${source.issue ? `, no. ${source.issue}` : ""}` : source.issue ? `no. ${source.issue}` : "";
  const pages = source.pages ? `: ${source.pages}` : "";
  const url = helpers.normalizeDoiOrUrl(source.url);

  return {
    full: `${author ? `${author}. ` : ""}${year}. "${source.title || "Untitled article"}." ${source.journalName || "Untitled journal"}${volumeIssue ? ` ${volumeIssue}` : ""}${pages}. ${url}.`.replace(/\s+/g, " ").trim(),
    inText: getChicagoInText(source, helpers)
  };
}

window.AutoCiteChicago = {
  generateChicago,
  generateChicagoPDF,
  generateChicagoBook,
  generateChicagoJournal
};
})();
