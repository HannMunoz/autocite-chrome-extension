// APA 7th edition website formatter.
(() => {

function getAuthorPart(author) {
  return author.endsWith(".") ? author : `${author}.`;
}

function generateAPA(source, helpers) {
  const author = helpers.formatApaContributorList(source);
  const year = helpers.getYear(source.publishedDate) || "n.d.";
  const date = helpers.getApaDate(source.publishedDate);
  const title = source.title || "Untitled source";
  const website = source.website && source.website !== author ? ` ${source.website}.` : "";
  const publisher = source.publisher && source.publisher !== source.website && source.publisher !== author ? ` ${source.publisher}.` : "";
  const url = source.url || "";

  return {
    full: `${getAuthorPart(author)} (${date}). ${title}.${website}${publisher} ${url}`.replace(/\s+/g, " ").trim(),
    inText: `(${helpers.getApaInTextContributor(source)}, ${year})`
  };
}

function generateAPAPDF(source, helpers) {
  const author = helpers.formatApaContributorList(source);
  const year = helpers.getYear(source.publishedDate) || "n.d.";
  const publisher = source.publisher && source.publisher !== author ? ` ${source.publisher}.` : "";
  const url = helpers.normalizeDoiOrUrl(source.url);

  return {
    full: `${getAuthorPart(author)} (${year}). ${source.title || "Untitled document"} [PDF].${publisher} ${url}`.replace(/\s+/g, " ").trim(),
    inText: `(${helpers.getApaInTextContributor(source)}, ${year})`
  };
}

function generateAPABook(source, helpers) {
  const author = helpers.formatApaContributorList(source);
  const year = helpers.getYear(source.publishedDate) || "n.d.";
  const publisher = source.publisher || "";
  const url = helpers.normalizeDoiOrUrl(source.url);

  return {
    full: `${getAuthorPart(author)} (${year}). ${source.title || "Untitled book"}. ${publisher}. ${url}`.replace(/\s+/g, " ").trim(),
    inText: `(${helpers.getApaInTextContributor(source)}, ${year})`
  };
}

function generateAPAJournal(source, helpers) {
  const author = helpers.formatApaContributorList(source);
  const year = helpers.getYear(source.publishedDate) || "n.d.";
  const journal = source.journalName || "Untitled journal";
  const volumeIssue = source.volume ? `${source.volume}${source.issue ? `(${source.issue})` : ""}` : source.issue ? `(${source.issue})` : "";
  const pages = source.pages ? `, ${source.pages}` : "";
  const url = helpers.normalizeDoiOrUrl(source.url);

  return {
    full: `${getAuthorPart(author)} (${year}). ${source.title || "Untitled article"}. ${journal}${volumeIssue ? `, ${volumeIssue}` : ""}${pages}. ${url}`.replace(/\s+/g, " ").trim(),
    inText: `(${helpers.getApaInTextContributor(source)}, ${year})`
  };
}

window.AutoCiteAPA = {
  generateAPA,
  generateAPAPDF,
  generateAPABook,
  generateAPAJournal
};
})();
