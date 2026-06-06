// History helpers.

(() => {
const HistoryContributors = window.AutoCiteContributors;

function getHistorySortKey(savedCitation) {
  if (typeof savedCitation === "string") {
    return savedCitation.toLowerCase();
  }

  const contributors = savedCitation.contributors || [];
  const primaryAuthor = HistoryContributors.getPrimaryAuthor(contributors);
  const organization = HistoryContributors.getOrganizationContributor(contributors);
  const authorLastName = primaryAuthor ? primaryAuthor.lastName || primaryAuthor.organizationName : "";
  const organizationName = organization ? organization.organizationName : savedCitation.organization || "";
  const title = savedCitation.sourceTitle || "";
  const fullCitation = savedCitation.fullCitation || "";

  return (authorLastName || organizationName || title || fullCitation).toLowerCase();
}

function getHistoryTime(savedCitation) {
  if (typeof savedCitation === "string") {
    return 0;
  }

  const time = new Date(savedCitation.dateCreated || "").getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getSortedHistoryEntries(history, sortValue) {
  const entries = history.map((savedCitation, index) => ({ savedCitation, index }));

  if (sortValue === "az") {
    return entries.sort((first, second) => getHistorySortKey(first.savedCitation).localeCompare(getHistorySortKey(second.savedCitation)));
  }

  if (sortValue === "za") {
    return entries.sort((first, second) => getHistorySortKey(second.savedCitation).localeCompare(getHistorySortKey(first.savedCitation)));
  }

  if (sortValue === "oldest") {
    return entries.sort((first, second) => getHistoryTime(first.savedCitation) - getHistoryTime(second.savedCitation));
  }

  return entries.sort((first, second) => getHistoryTime(second.savedCitation) - getHistoryTime(first.savedCitation));
}

function citationMatchesSearch(savedCitation, searchText) {
  const query = searchText.trim().toLowerCase();

  if (!query) {
    return true;
  }

  if (typeof savedCitation === "string") {
    return savedCitation.toLowerCase().includes(query);
  }

  return [
    savedCitation.sourceTitle,
    savedCitation.author,
    savedCitation.organization,
    savedCitation.url,
    savedCitation.fullCitation,
    savedCitation.inTextCitation
  ].some((value) => (value || "").toLowerCase().includes(query));
}

window.AutoCiteHistory = {
  getSortedHistoryEntries,
  citationMatchesSearch
};
})();
