// AutoCite sidebar entry file.
// This file connects the smaller helper files to the sidebar UI.
(() => {

const State = window.AutoCiteState;
const Security = window.AutoCiteSecurity;
const Storage = window.AutoCiteStorage;
const Contributors = window.AutoCiteContributors;
const CitationGenerator = window.AutoCiteCitationGenerator;
const CopyActions = window.AutoCiteCopyActions;
const ExportTools = window.AutoCiteExport;
const HistoryTools = window.AutoCiteHistory;
const Metadata = window.AutoCiteMetadata;
const UI = window.AutoCiteUI;
const SIDEBAR_STATE_KEY = "sidebarState";
const SIDEBAR_STATE_OPEN = "open";
const SIDEBAR_STATE_MINIMIZED = "minimized";
const SIDEBAR_STATE_CLOSED = "closed";

const requiredModules = {
  State,
  Security,
  Storage,
  Contributors,
  CitationGenerator,
  CopyActions,
  ExportTools,
  HistoryTools,
  Metadata,
  UI
};

Object.keys(requiredModules).forEach((moduleName) => {
  if (!requiredModules[moduleName]) {
    throw new Error(`AutoCite module failed to load: ${moduleName}`);
  }
});

const elements = {
  copiedText: document.querySelector("#copiedText"),
  sourceType: document.querySelector("#sourceType"),
  contributorsList: document.querySelector("#contributorsList"),
  sourceTitle: document.querySelector("#sourceTitle"),
  sourceTitleLabel: document.querySelector("#sourceTitleLabel"),
  sourceWebsite: document.querySelector("#sourceWebsite"),
  sourcePublisher: document.querySelector("#sourcePublisher"),
  sourcePublisherLabel: document.querySelector("#sourcePublisherLabel"),
  journalName: document.querySelector("#journalName"),
  sourceVolume: document.querySelector("#sourceVolume"),
  sourceIssue: document.querySelector("#sourceIssue"),
  sourcePages: document.querySelector("#sourcePages"),
  sourceUrl: document.querySelector("#sourceUrl"),
  sourceUrlLabel: document.querySelector("#sourceUrlLabel"),
  publishedDate: document.querySelector("#publishedDate"),
  publishedDateLabel: document.querySelector("#publishedDateLabel"),
  accessDate: document.querySelector("#accessDate"),
  citationStyle: document.querySelector("#citationStyle"),
  manualOverride: document.querySelector("#manualOverride"),
  fullCitation: document.querySelector("#fullCitation"),
  inTextCitation: document.querySelector("#inTextCitation"),
  validationWarnings: document.querySelector("#validationWarnings"),
  historySearch: document.querySelector("#historySearch"),
  historySort: document.querySelector("#historySort"),
  historyActions: document.querySelector("#historyActions"),
  selectionStatus: document.querySelector("#selectionStatus"),
  citationHistory: document.querySelector("#citationHistory"),
  bibliographyCount: document.querySelector("#bibliographyCount"),
  bibliographyPreview: document.querySelector("#bibliographyPreview")
};

const buttons = {
  clearCopiedText: document.querySelector("#clearCopiedTextButton"),
  copyCopiedText: document.querySelector("#copyCopiedTextButton"),
  addContributor: document.querySelector("#addContributorButton"),
  generate: document.querySelector("#generateButton"),
  save: document.querySelector("#saveCitationButton"),
  clear: document.querySelector("#clearCitationButton"),
  copyFull: document.querySelector("#copyFullButton"),
  copyTextInText: document.querySelector("#copyInTextButton"),
  editSelected: document.querySelector("#editSelectedButton"),
  deleteSelected: document.querySelector("#deleteSelectedButton"),
  copySelected: document.querySelector("#copySelectedButton"),
  clearHistory: document.querySelector("#clearHistoryButton"),
  copyBibliography: document.querySelector("#copyBibliographyButton"),
  exportTxt: document.querySelector("#exportTxtButton"),
  exportDocx: document.querySelector("#exportDocxButton"),
  minimizeSidebar: document.querySelector("#minimizeSidebarButton"),
  closeSidebar: document.querySelector("#closeSidebarButton")
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getSourceFromForm() {
  return {
    sourceType: elements.sourceType.value,
    contributors: Contributors.getContributorsFromForm(elements.contributorsList),
    title: Security.sanitizeText(elements.sourceTitle.value),
    website: Security.sanitizeText(elements.sourceWebsite.value),
    publisher: Security.sanitizeText(elements.sourcePublisher.value),
    journalName: Security.sanitizeText(elements.journalName.value),
    volume: Security.sanitizeText(elements.sourceVolume.value, 100),
    issue: Security.sanitizeText(elements.sourceIssue.value, 100),
    pages: Security.sanitizeText(elements.sourcePages.value, 100),
    url: Security.sanitizeUrl(elements.sourceUrl.value),
    publishedDate: Security.sanitizeText(elements.publishedDate.value, 100),
    accessDate: elements.accessDate.value || getTodayDate()
  };
}

const sourceTypeLabels = {
  website: {
    title: "Page Title",
    titlePlaceholder: "Page title",
    publisher: "Publisher or Organization",
    date: "Published Date",
    url: "URL"
  },
  pdf: {
    title: "PDF or Document Title",
    titlePlaceholder: "PDF or document title",
    publisher: "Publisher or Organization",
    date: "Published Date or Year",
    url: "PDF URL"
  },
  book: {
    title: "Book Title",
    titlePlaceholder: "Book title",
    publisher: "Publisher",
    date: "Publication Year",
    url: "URL or DOI"
  },
  journal: {
    title: "Article Title",
    titlePlaceholder: "Journal article title",
    publisher: "Publisher or Organization",
    date: "Publication Year or Date",
    url: "DOI or URL"
  }
};

function updateSourceTypeFields() {
  const sourceType = elements.sourceType.value;
  const labels = sourceTypeLabels[sourceType] || sourceTypeLabels.website;

  document.querySelectorAll("[data-source-types]").forEach((field) => {
    const sourceTypes = (field.dataset.sourceTypes || "").split(/\s+/).filter(Boolean);
    UI.toggleClass(field, "is-hidden", !sourceTypes.includes(sourceType));
  });

  elements.sourceTitleLabel.textContent = labels.title;
  elements.sourceTitle.placeholder = labels.titlePlaceholder;
  elements.sourcePublisherLabel.textContent = labels.publisher;
  elements.publishedDateLabel.textContent = labels.date;
  elements.sourceUrlLabel.textContent = labels.url;
}

function renderValidationWarnings(warnings) {
  elements.validationWarnings.replaceChildren();

  warnings.forEach((warning) => {
    const warningItem = document.createElement("div");
    warningItem.className = "warning-item";
    warningItem.textContent = warning;
    elements.validationWarnings.appendChild(warningItem);
  });
}

function findDuplicateCitation(url, fullCitation) {
  const cleanUrl = (url || "").toLowerCase();
  const cleanCitation = (fullCitation || "").toLowerCase();

  return State.currentHistory.find((savedCitation) => {
    if (typeof savedCitation === "string") {
      return savedCitation.toLowerCase() === cleanCitation;
    }

    const savedUrl = (savedCitation.url || "").toLowerCase();
    const savedFullCitation = (savedCitation.fullCitation || "").toLowerCase();

    return (cleanUrl && cleanUrl === savedUrl) || (cleanCitation && cleanCitation === savedFullCitation);
  });
}

function getValidationWarnings(source, citation) {
  const warnings = [];

  if (!source.title) {
    warnings.push("Missing title. Add a source title for a stronger citation.");
  }

  const hasAuthorName = Contributors.getAuthorContributors(source.contributors).some((contributor) => {
    return contributor.firstName || contributor.middleName || contributor.lastName || contributor.suffix;
  });

  if (!hasAuthorName && !Contributors.getOrganizationContributor(source.contributors)) {
    warnings.push("Author not detected. Please review manually.");
  }

  if (!source.publishedDate) {
    warnings.push("Published date not detected. AutoCite will use n.d.");
  }

  if ((source.sourceType === "website" || source.sourceType === "pdf") && !source.url) {
    warnings.push(`Missing URL for this ${source.sourceType} source.`);
  }

  if (source.sourceType === "journal" && !source.journalName) {
    warnings.push("Journal name not provided. Please review manually.");
  }

  if (source.sourceType === "book" && !source.publisher) {
    warnings.push("Book publisher not provided. Please review manually.");
  }

  if (findDuplicateCitation(source.url, citation.full)) {
    warnings.push("Possible duplicate: a saved citation already uses this URL or citation text.");
  }

  return warnings;
}

function generateCitation() {
  const source = getSourceFromForm();
  const citation = CitationGenerator.generateCitationForSource(elements.citationStyle.value, source);

  renderValidationWarnings(getValidationWarnings(source, citation));

  if (elements.manualOverride.checked) {
    return;
  }

  elements.fullCitation.value = citation.full;
  elements.inTextCitation.value = citation.inText;
  UI.animateCitationFields([elements.fullCitation, elements.inTextCitation]);
}

function regenerateFromContributorEdit() {
  elements.manualOverride.checked = false;
  generateCitation();
}

function fillSourceDetails(details) {
  const sourceDetails = Security.sanitizeSourceDetails(details);

  elements.sourceType.value = sourceDetails.sourceType || "website";
  updateSourceTypeFields();
  elements.sourceTitle.value = sourceDetails.title || "";
  Contributors.setContributors(
    elements.contributorsList,
    sourceDetails.author ? Contributors.splitDetectedAuthors(sourceDetails.author) : [Contributors.createEmptyContributor()],
    regenerateFromContributorEdit
  );
  elements.sourceWebsite.value = sourceDetails.website || "";
  elements.sourcePublisher.value = sourceDetails.publisher || "";
  elements.journalName.value = sourceDetails.journalName || "";
  elements.sourceVolume.value = sourceDetails.volume || "";
  elements.sourceIssue.value = sourceDetails.issue || "";
  elements.sourcePages.value = sourceDetails.pages || "";
  elements.sourceUrl.value = sourceDetails.url || "";
  elements.publishedDate.value = sourceDetails.publishedDate || "";
  elements.accessDate.value = sourceDetails.accessDate || getTodayDate();
  generateCitation();
}

function fillCopiedSource(copiedSource, showUpdatedToast = false) {
  if (!copiedSource) {
    return;
  }

  const safeCopiedSource = Security.sanitizeCopiedSource(copiedSource);
  elements.manualOverride.checked = false;
  elements.copiedText.value = safeCopiedSource.copiedText;
  fillSourceDetails(safeCopiedSource.sourceDetails);

  if (showUpdatedToast) {
    UI.showMessage("Updated!", "success");
  }
}

function loadSavedSelection() {
  Storage.storageGet(["latestCopiedSource", "latestSelectedText"], (result) => {
    if (result.latestCopiedSource) {
      fillCopiedSource(result.latestCopiedSource);
      return;
    }

    elements.copiedText.value = Security.sanitizeCopiedText(result.latestSelectedText) || elements.copiedText.value;
  });
}

function loadPageDetails() {
  Metadata.getActivePageDetails((response) => {
    fillSourceDetails(response && response.sourceDetails);

    if (response && response.selectedText) {
      elements.copiedText.value = Security.sanitizeCopiedText(response.selectedText);
    } else {
      loadSavedSelection();
    }
  }, loadSavedSelection);
}

function clearCitationForm(message = "Cleared!") {
  elements.copiedText.value = "";
  elements.sourceType.value = "website";
  updateSourceTypeFields();
  elements.sourceTitle.value = "";
  Contributors.setContributors(elements.contributorsList, [Contributors.createEmptyContributor()], regenerateFromContributorEdit);
  elements.sourceWebsite.value = "";
  elements.sourcePublisher.value = "";
  elements.journalName.value = "";
  elements.sourceVolume.value = "";
  elements.sourceIssue.value = "";
  elements.sourcePages.value = "";
  elements.sourceUrl.value = "";
  elements.publishedDate.value = "";
  elements.accessDate.value = getTodayDate();
  elements.citationStyle.value = "apa";
  elements.manualOverride.checked = false;
  elements.fullCitation.value = "";
  elements.inTextCitation.value = "";
  elements.validationWarnings.replaceChildren();
  Storage.storageSet({ latestCopiedSource: null, latestSelectedText: "" });
  Metadata.sendMessageToActiveTab({ type: "CLEAR_AUTOCITE_SELECTION" });
  UI.showMessage(message, "success");
}

function clearCitationHistory() {
  const confirmationMessage = "Are you sure you want to clear all saved citations? This cannot be undone.";

  if (!window.confirm(confirmationMessage)) {
    return;
  }

  State.selectedHistoryIndexes.clear();
  State.editingHistoryIndexes.clear();

  Storage.storageSet({ citationHistory: [] }, () => {
    renderHistory([]);
    UI.showMessage("Cleared!", "success");
  });
}

function getCitationStyleLabel(styleValue) {
  if (styleValue === "apa") {
    return "APA 7th edition";
  }

  if (styleValue === "mla") {
    return "MLA 9th edition";
  }

  return "Chicago Author-Date style";
}

function getCitationStyleValue(styleLabel) {
  if (styleLabel === "APA 7th edition") {
    return "apa";
  }

  if (styleLabel === "MLA 9th edition") {
    return "mla";
  }

  return "chicago";
}

function createSavedCitation() {
  const contributors = Contributors.getContributorsFromForm(elements.contributorsList);
  const authorText = Contributors.getAuthorContributors(contributors).map(Contributors.formatFullName).filter(Boolean).join(", ");
  const organizationContributor = Contributors.getOrganizationContributor(contributors);

  return {
    fullCitation: Security.sanitizeCopiedText(elements.fullCitation.value),
    inTextCitation: Security.sanitizeText(elements.inTextCitation.value),
    sourceType: elements.sourceType.value,
    contributors,
    author: Security.sanitizeText(authorText),
    organization: Security.sanitizeText(organizationContributor ? organizationContributor.organizationName : elements.sourceWebsite.value),
    publisher: Security.sanitizeText(elements.sourcePublisher.value),
    journalName: Security.sanitizeText(elements.journalName.value),
    volume: Security.sanitizeText(elements.sourceVolume.value, 100),
    issue: Security.sanitizeText(elements.sourceIssue.value, 100),
    pages: Security.sanitizeText(elements.sourcePages.value, 100),
    sourceTitle: Security.sanitizeText(elements.sourceTitle.value),
    url: Security.sanitizeUrl(elements.sourceUrl.value),
    citationStyle: getCitationStyleLabel(elements.citationStyle.value),
    dateCreated: new Date().toISOString(),
    copiedText: Security.sanitizeCopiedText(elements.copiedText.value)
  };
}

function saveCitation() {
  const savedCitation = createSavedCitation();

  if (!savedCitation.fullCitation) {
    UI.showMessage("Generate or type a citation first.", "warning");
    return;
  }

  const duplicateCitation = findDuplicateCitation(savedCitation.url, savedCitation.fullCitation);

  if (duplicateCitation && !window.confirm("This citation looks like a duplicate. Save it anyway?")) {
    UI.showMessage("Duplicate not saved.", "warning");
    return;
  }

  const newHistory = [savedCitation, ...State.currentHistory];

  Storage.storageSet({ citationHistory: newHistory }, () => {
    renderHistory(newHistory);
    clearCitationForm("Saved!");
  });
}

function updateSelectionActions() {
  const selectedCount = State.selectedHistoryIndexes.size;

  if (!selectedCount) {
    UI.addClasses(elements.historyActions, "is-hidden");
    elements.selectionStatus.textContent = "";
    buttons.editSelected.disabled = false;
    buttons.editSelected.removeAttribute("title");
    return;
  }

  UI.removeClasses(elements.historyActions, "is-hidden");
  elements.selectionStatus.textContent = `${selectedCount} citation${selectedCount === 1 ? "" : "s"} selected`;
  buttons.editSelected.disabled = selectedCount !== 1;
  buttons.editSelected.title = selectedCount === 1 ? "Edit selected citation" : "Select only one citation to edit";
}

function citationMatchesCurrentSearch(savedCitation) {
  return HistoryTools.citationMatchesSearch(savedCitation, elements.historySearch.value);
}

function renderHistory(history) {
  const safeHistory = Array.isArray(history) ? history : [];
  State.currentHistory = safeHistory;
  updateBibliographyPreview();
  updateSelectionActions();
  elements.citationHistory.replaceChildren();

  if (!safeHistory.length) {
    elements.citationHistory.appendChild(UI.createTextElement("li", "No saved citations yet.", "empty-history"));
    return;
  }

  const visibleEntries = HistoryTools.getSortedHistoryEntries(safeHistory, elements.historySort.value)
    .filter(({ savedCitation }) => citationMatchesCurrentSearch(savedCitation));

  if (!visibleEntries.length) {
    elements.citationHistory.appendChild(UI.createTextElement("li", "No matching citations.", "empty-history"));
    return;
  }

  visibleEntries.forEach(({ savedCitation, index }) => {
    const listItem = document.createElement("li");
    listItem.className = "history-item fade-in";

    if (typeof savedCitation === "string") {
      listItem.textContent = savedCitation;
      elements.citationHistory.appendChild(listItem);
      return;
    }

    const row = document.createElement("div");
    row.className = "history-select";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = State.selectedHistoryIndexes.has(index);
    checkbox.setAttribute("aria-label", "Select citation");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        State.selectedHistoryIndexes.add(index);
      } else {
        State.selectedHistoryIndexes.delete(index);
        State.editingHistoryIndexes.delete(index);
      }

      updateSelectionActions();
    });

    const content = document.createElement("div");
    content.className = "history-content";
    content.append(
      UI.createTextElement("strong", savedCitation.sourceTitle || "Untitled source"),
      UI.createTextElement("p", `${savedCitation.citationStyle || "Citation"} - ${formatDateCreated(savedCitation.dateCreated)}`, "history-meta"),
      UI.createTextElement("p", savedCitation.fullCitation || ""),
      UI.createTextElement("p", `In-text: ${savedCitation.inTextCitation || "None"}`),
      UI.createTextElement("p", Security.sanitizeUrl(savedCitation.url) || "No URL saved", "history-url"),
      createCopiedTextDetails(savedCitation.copiedText)
    );

    row.append(checkbox, content);
    listItem.appendChild(row);

    if (State.editingHistoryIndexes.has(index)) {
      addHistoryEditForm(listItem, savedCitation, index);
    }

    elements.citationHistory.appendChild(listItem);
  });
}

function reloadCitationHistory() {
  Storage.storageGet(["citationHistory"], (result) => {
    renderHistory(result.citationHistory || []);
  });
}

function formatDateCreated(dateText) {
  const date = new Date(dateText);

  if (Number.isNaN(date.getTime())) {
    return dateText || "Unknown date";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function createCopiedTextDetails(copiedText) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  const body = document.createElement("p");

  summary.textContent = "Original copied text";
  body.textContent = copiedText || "No copied text saved.";
  details.append(summary, body);

  return details;
}

function createHistoryEditField(labelText, field) {
  const label = document.createElement("label");
  label.className = "history-edit-field";
  label.append(document.createTextNode(labelText), field);
  return label;
}

function createHistoryEditButton(className, text) {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.textContent = text;
  return button;
}

function addHistoryEditForm(listItem, savedCitation, index) {
  const form = document.createElement("div");
  form.className = "history-edit-form";

  const titleInput = document.createElement("input");
  titleInput.className = "edit-title";
  titleInput.type = "text";

  const styleSelect = document.createElement("select");
  styleSelect.className = "edit-style";
  [
    ["apa", "APA 7th edition"],
    ["mla", "MLA 9th edition"],
    ["chicago", "Chicago Author-Date style"]
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    styleSelect.appendChild(option);
  });

  const fullCitation = document.createElement("textarea");
  fullCitation.className = "edit-full";
  const inTextCitation = document.createElement("input");
  inTextCitation.className = "edit-in-text";
  inTextCitation.type = "text";
  const urlInput = document.createElement("input");
  urlInput.className = "edit-url";
  urlInput.type = "url";
  const copiedText = document.createElement("textarea");
  copiedText.className = "edit-copied-text";
  const copyActions = document.createElement("div");
  copyActions.className = "history-edit-copy-actions";
  copyActions.append(
    createHistoryEditButton("secondary-button edit-copy-text-in-text", "Copy Text + In-text Citation"),
    createHistoryEditButton("secondary-button edit-copy-full", "Copy Full Citation"),
    createHistoryEditButton("secondary-button edit-copy-in-text", "Copy In-text Citation")
  );

  form.append(
    createHistoryEditField("Source title", titleInput),
    createHistoryEditField("Citation style", styleSelect),
    createHistoryEditField("Full citation", fullCitation),
    createHistoryEditField("In-text citation", inTextCitation),
    createHistoryEditField("URL", urlInput),
    createHistoryEditField("Original copied text", copiedText),
    copyActions
  );

  form.querySelector(".edit-title").value = savedCitation.sourceTitle || "";
  form.querySelector(".edit-style").value = getCitationStyleValue(savedCitation.citationStyle);
  form.querySelector(".edit-full").value = savedCitation.fullCitation || "";
  form.querySelector(".edit-in-text").value = savedCitation.inTextCitation || "";
  form.querySelector(".edit-url").value = savedCitation.url || "";
  form.querySelector(".edit-copied-text").value = savedCitation.copiedText || "";

  const saveButton = document.createElement("button");
  saveButton.className = "primary-button history-edit-save";
  saveButton.type = "button";
  saveButton.textContent = "Save Changes";
  listen(saveButton, "click", () => saveEditedCitation(index, listItem));

  const cancelButton = document.createElement("button");
  cancelButton.className = "soft-button history-edit-cancel";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  listen(cancelButton, "click", () => {
    State.editingHistoryIndexes.delete(index);
    renderHistory(State.currentHistory);
  });

  listen(form.querySelector(".edit-copy-text-in-text"), "click", () => {
    const copiedText = form.querySelector(".edit-copied-text").value;
    const inTextCitation = form.querySelector(".edit-in-text").value;
    const combinedText = CopyActions.buildCopiedTextWithInTextCitation(copiedText, inTextCitation);
    CopyActions.copyText(combinedText, "copied text with in-text citation", UI.showMessage);
  });

  listen(form.querySelector(".edit-copy-full"), "click", () => {
    CopyActions.copyText(form.querySelector(".edit-full").value, "full citation", UI.showMessage);
  });

  listen(form.querySelector(".edit-copy-in-text"), "click", () => {
    CopyActions.copyText(form.querySelector(".edit-in-text").value, "in-text citation", UI.showMessage);
  });

  form.append(saveButton, cancelButton);
  listItem.appendChild(form);
}

function saveEditedCitation(index, listItem) {
  const savedCitation = State.currentHistory[index];
  const updatedCitation = {
    ...savedCitation,
    sourceTitle: Security.sanitizeText(listItem.querySelector(".edit-title").value),
    citationStyle: getCitationStyleLabel(listItem.querySelector(".edit-style").value),
    fullCitation: Security.sanitizeCopiedText(listItem.querySelector(".edit-full").value),
    inTextCitation: Security.sanitizeText(listItem.querySelector(".edit-in-text").value),
    url: Security.sanitizeUrl(listItem.querySelector(".edit-url").value),
    copiedText: Security.sanitizeCopiedText(listItem.querySelector(".edit-copied-text").value)
  };

  const updatedHistory = State.currentHistory.map((citation, citationIndex) => {
    return citationIndex === index ? updatedCitation : citation;
  });

  State.editingHistoryIndexes.delete(index);

  Storage.storageSet({ citationHistory: updatedHistory }, () => {
    reloadCitationHistory();
    UI.showMessage("Updated!", "success");
  });
}

function editSelectedCitations() {
  if (!State.selectedHistoryIndexes.size) {
    UI.showMessage("Select a citation first.", "warning");
    return;
  }

  if (State.selectedHistoryIndexes.size > 1) {
    UI.showMessage("Select one citation to edit.", "warning");
    return;
  }

  State.selectedHistoryIndexes.forEach((index) => {
    if (typeof State.currentHistory[index] !== "string") {
      State.editingHistoryIndexes.add(index);
    }
  });

  renderHistory(State.currentHistory);
}

function deleteSelectedCitations() {
  if (!State.selectedHistoryIndexes.size) {
    UI.showMessage("Select a citation first.", "warning");
    return;
  }

  const count = State.selectedHistoryIndexes.size;

  if (!window.confirm(`Delete ${count} selected citation${count === 1 ? "" : "s"}?`)) {
    return;
  }

  const newHistory = State.currentHistory.filter((citation, index) => !State.selectedHistoryIndexes.has(index));
  State.selectedHistoryIndexes.clear();
  State.editingHistoryIndexes.clear();

  Storage.storageSet({ citationHistory: newHistory }, () => {
    renderHistory(newHistory);
    UI.showMessage("Deleted!", "success");
  });
}

function getSelectedCitations() {
  return State.currentHistory.filter((savedCitation, index) => {
    return State.selectedHistoryIndexes.has(index) && typeof savedCitation !== "string";
  });
}

function copySelectedCitations() {
  const selectedCitations = getSelectedCitations();

  if (!selectedCitations.length) {
    UI.showMessage("Select a citation first.", "warning");
    return;
  }

  const selectedText = selectedCitations.map((citation) => citation.fullCitation).join("\n\n");
  CopyActions.copyText(selectedText, "selected citations", UI.showMessage);
}

function updateBibliographyPreview() {
  const sortedCitations = ExportTools.getSortedBibliographyCitations(State.currentHistory);
  elements.bibliographyCount.textContent = `Total Citations: ${sortedCitations.length}`;
  elements.bibliographyPreview.value = ExportTools.getBibliographyText(State.currentHistory);
}

function copyBibliography() {
  updateBibliographyPreview();
  CopyActions.copyText(elements.bibliographyPreview.value, "bibliography", UI.showMessage);
}

function exportTxt() {
  updateBibliographyPreview();

  if (!elements.bibliographyPreview.value) {
    UI.showMessage("No saved citations yet.", "warning");
    return;
  }

  ExportTools.downloadBlob(new Blob([elements.bibliographyPreview.value], { type: "text/plain" }), "autocite-bibliography.txt");
  UI.showMessage("TXT exported!", "success");
}

function exportDocx() {
  const citationTexts = ExportTools.getSortedBibliographyCitations(State.currentHistory).map((savedCitation) => {
    return typeof savedCitation === "string" ? savedCitation : savedCitation.fullCitation;
  });

  if (!citationTexts.length) {
    UI.showMessage("No saved citations yet.", "warning");
    return;
  }

  ExportTools.downloadBlob(ExportTools.createDocxFile(citationTexts), "autocite-bibliography.docx");
  UI.showMessage("DOCX exported!", "success");
}

function minimizeSidebar() {
  Storage.storageSet({ [SIDEBAR_STATE_KEY]: SIDEBAR_STATE_MINIMIZED }, () => {
    UI.showMessage("Minimized", "info");
    window.close();
  });
}

function closeSidebarFully() {
  Storage.storageSet({ [SIDEBAR_STATE_KEY]: SIDEBAR_STATE_CLOSED }, () => {
    UI.showMessage("Closed", "info");
    window.close();
  });
}

function listen(target, eventName, handler) {
  if (target && typeof target.addEventListener === "function") {
    target.addEventListener(eventName, handler);
  }
}

function setupEventListeners() {
  listen(buttons.clearCopiedText, "click", () => clearCitationForm());
  listen(buttons.copyCopiedText, "click", () => CopyActions.copyText(elements.copiedText.value, "copied text", UI.showMessage));
  listen(buttons.addContributor, "click", () => {
    Contributors.renderContributor(elements.contributorsList, Contributors.createEmptyContributor(), regenerateFromContributorEdit);
    generateCitation();
  });
  listen(buttons.generate, "click", generateCitation);
  listen(buttons.save, "click", saveCitation);
  listen(buttons.clear, "click", () => clearCitationForm());
  listen(buttons.copyFull, "click", () => CopyActions.copyText(elements.fullCitation.value, "full citation", UI.showMessage));
  listen(buttons.copyTextInText, "click", () => {
    const text = CopyActions.buildCopiedTextWithInTextCitation(elements.copiedText.value, elements.inTextCitation.value);
    CopyActions.copyText(text, "copied text with in-text citation", UI.showMessage);
  });
  listen(buttons.editSelected, "click", editSelectedCitations);
  listen(buttons.deleteSelected, "click", deleteSelectedCitations);
  listen(buttons.copySelected, "click", copySelectedCitations);
  listen(buttons.clearHistory, "click", clearCitationHistory);
  listen(buttons.copyBibliography, "click", copyBibliography);
  listen(buttons.exportTxt, "click", exportTxt);
  listen(buttons.exportDocx, "click", exportDocx);
  listen(buttons.minimizeSidebar, "click", minimizeSidebar);
  listen(buttons.closeSidebar, "click", closeSidebarFully);
  listen(elements.historySort, "change", () => renderHistory(State.currentHistory));
  listen(elements.historySearch, "input", () => renderHistory(State.currentHistory));

  document.querySelectorAll(".tab-button").forEach((button) => {
    listen(button, "click", () => UI.showTab(button.dataset.tab));
  });

  [
    elements.sourceType,
    elements.sourceTitle,
    elements.sourceWebsite,
    elements.sourcePublisher,
    elements.journalName,
    elements.sourceVolume,
    elements.sourceIssue,
    elements.sourcePages,
    elements.sourceUrl,
    elements.publishedDate,
    elements.accessDate,
    elements.citationStyle
  ].filter(Boolean).forEach((field) => {
    listen(field, "input", generateCitation);
    listen(field, "change", generateCitation);
  });

  listen(elements.sourceType, "change", () => {
    updateSourceTypeFields();
    generateCitation();
  });

  listen(elements.contributorsList, "input", (event) => {
    if (event.target.matches("input, select")) {
      regenerateFromContributorEdit();
    }
  });

  listen(elements.contributorsList, "change", (event) => {
    if (event.target.matches("input, select")) {
      Contributors.updateContributorCardFields(event.target.closest(".contributor-card"));
      regenerateFromContributorEdit();
    }
  });

  listen(elements.manualOverride, "change", generateCitation);
  listen(elements.fullCitation, "input", () => {
    elements.manualOverride.checked = true;
  });
  listen(elements.inTextCitation, "input", () => {
    elements.manualOverride.checked = true;
  });

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "COPIED_TEXT_DETECTED" || message.type === "AUTOCITE_COPIED_SOURCE_UPDATED") {
        fillCopiedSource(message.copiedSource, true);
      }
    });
  }

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.latestCopiedSource && changes.latestCopiedSource.newValue) {
        fillCopiedSource(changes.latestCopiedSource.newValue, true);
      }

      if (areaName === "local" && changes.citationHistory && changes.citationHistory.newValue) {
        renderHistory(changes.citationHistory.newValue || []);
      }
    });
  }
}

function startAutoCite() {
  const requiredDomElements = [...Object.values(elements), ...Object.values(buttons)];

  if (requiredDomElements.some((element) => !element)) {
    return;
  }

  elements.accessDate.value = getTodayDate();
  updateSourceTypeFields();
  Contributors.setContributors(elements.contributorsList, [Contributors.createEmptyContributor()], regenerateFromContributorEdit);
  setupEventListeners();
  Storage.storageSet({ [SIDEBAR_STATE_KEY]: SIDEBAR_STATE_OPEN });
  loadPageDetails();
  reloadCitationHistory();
}

startAutoCite();
})();
