// MLA 9th edition website formatter.
(() => {

function generateMLA(source, helpers) {
  const authorText = helpers.formatMlaContributorList(source);
  const author = authorText ? `${authorText}. ` : "";
  const title = source.title || "Untitled source";
  const website = source.website || "";
  const publisher = source.publisher || "";
  const date = source.publishedDate ? `${helpers.formatReadableDate(source.publishedDate)}, ` : "";
  const url = helpers.normalizeDoiOrUrl(source.url);
  const titlePart = `"${title}."`;
  const websitePart = website ? ` ${website},` : "";
  const publisherPart = publisher && publisher !== website ? ` ${publisher},` : "";

  return {
    full: `${author}${titlePart}${websitePart}${publisherPart} ${date}${url}.`.replace(/\s+/g, " ").trim(),
    inText: getMlaInText(source, helpers)
  };
}

function getMlaInText(source, helpers) {
  const primaryAuthor = helpers.getPrimaryAuthor(source.contributors);
  const organization = helpers.getOrganizationContributor(source.contributors);

  if (!primaryAuthor && !organization) {
    return `("${helpers.getShortTitle(source.title)}")`;
  }

  return `(${helpers.getGeneralInTextContributor(source, "mla")})`;
}

function generateMLAPDF(source, helpers) {
  const author = helpers.formatMlaContributorList(source);
  const year = helpers.getYear(source.publishedDate);
  const publisher = source.publisher || "";
  const url = helpers.normalizeDoiOrUrl(source.url);

  return {
    full: `${author ? `${author}. ` : ""}${source.title || "Untitled document"}. PDF file. ${publisher}${year ? `, ${year}` : ""}. ${url}.`.replace(/\s+/g, " ").trim(),
    inText: getMlaInText(source, helpers)
  };
}

function generateMLABook(source, helpers) {
  const author = helpers.formatMlaContributorList(source);
  const year = helpers.getYear(source.publishedDate);
  const publisher = source.publisher || "";
  const url = helpers.normalizeDoiOrUrl(source.url);

  return {
    full: `${author ? `${author}. ` : ""}${source.title || "Untitled book"}. ${publisher}${year ? `, ${year}` : ""}${url ? `, ${url}` : ""}.`.replace(/\s+/g, " ").trim(),
    inText: getMlaInText(source, helpers)
  };
}

function generateMLAJournal(source, helpers) {
  const author = helpers.formatMlaContributorList(source);
  const year = helpers.getYear(source.publishedDate);
  const volume = source.volume ? `vol. ${source.volume}` : "";
  const issue = source.issue ? `no. ${source.issue}` : "";
  const pages = source.pages ? `pp. ${source.pages}` : "";
  const details = [volume, issue, year, pages].filter(Boolean).join(", ");
  const url = helpers.normalizeDoiOrUrl(source.url);

  return {
    full: `${author ? `${author}. ` : ""}"${source.title || "Untitled article"}." ${source.journalName || "Untitled journal"}${details ? `, ${details}` : ""}${url ? `, ${url}` : ""}.`.replace(/\s+/g, " ").trim(),
    inText: getMlaInText(source, helpers)
  };
}

window.AutoCiteMLA = {
  generateMLA,
  generateMLAPDF,
  generateMLABook,
  generateMLAJournal
};
})();
