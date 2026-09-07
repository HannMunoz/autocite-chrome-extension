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
const SIDEBAR_STATE_DISMISSED = "dismissed";
const SELECTED_CITATION_STYLE_KEY = "selectedCitationStyle";
const CITATION_PROJECTS_KEY = "citationProjects";
const ALL_PROJECTS_ID = "all";
const UNFILED_PROJECT_ID = "unfiled";
let sidebarUnloadState = SIDEBAR_STATE_CLOSED;
let sidebarTabId = null;

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
  citationStyleDropdown: document.querySelector("#citationStyleDropdown"),
  citationStyleButton: document.querySelector("#citationStyleButton"),
  citationStyleSelected: document.querySelector("#citationStyleSelected"),
  citationStyleMenu: document.querySelector("#citationStyleMenu"),
  manualOverride: document.querySelector("#manualOverride"),
  fullCitation: document.querySelector("#fullCitation"),
  inTextCitation: document.querySelector("#inTextCitation"),
  validationWarnings: document.querySelector("#validationWarnings"),
  sourceScanStatus: document.querySelector("#sourceScanStatus"),
  sourceDetailsFields: document.querySelector("#sourceDetailsFields"),
  historySearch: document.querySelector("#historySearch"),
  historySort: document.querySelector("#historySort"),
  historySortButton: document.querySelector("#historySortButton"),
  projectFilter: document.querySelector("#projectFilter"),
  projectFilterMenu: document.querySelector("#projectFilterMenu"),
  projectFilterSelected: document.querySelector("#projectFilterSelected"),
  projectFilterOptions: document.querySelector("#projectFilterOptions"),
  folderMenu: document.querySelector("#folderMenu"),
  moveFolderSelect: document.querySelector("#moveFolderSelect"),
  moveFolderMenu: document.querySelector("#moveFolderMenu"),
  moveFolderOptions: document.querySelector("#moveFolderOptions"),
  historyActions: document.querySelector("#historyActions"),
  selectionStatus: document.querySelector("#selectionStatus"),
  citationHistory: document.querySelector("#citationHistory"),
  exportProjectFilter: document.querySelector("#exportProjectFilter"),
  exportProjectFilterMenu: document.querySelector("#exportProjectFilterMenu"),
  exportProjectFilterSelected: document.querySelector("#exportProjectFilterSelected"),
  exportProjectFilterOptions: document.querySelector("#exportProjectFilterOptions"),
  exportMenu: document.querySelector("#exportMenu"),
  bibliographyHeading: document.querySelector("#bibliographyHeading"),
  bibliographyCount: document.querySelector("#bibliographyCount"),
  bibliographyPreview: document.querySelector("#bibliographyPreview"),
  bibliographyPreviewDisplay: document.querySelector("#bibliographyPreviewDisplay"),
  activeTabStatus: document.querySelector("#activeTabStatus"),
  activeTabStatusTitle: document.querySelector("#activeTabStatusTitle"),
  activeTabStatusDetails: document.querySelector("#activeTabStatusDetails")
};

const buttons = {
  clearCopiedText: document.querySelector("#clearCopiedTextButton"),
  addContributor: document.querySelector("#addContributorButton"),
  citeSource: document.querySelector("#citeSourceButton"),
  save: document.querySelector("#saveCitationButton"),
  toggleSourceDetails: document.querySelector("#toggleSourceDetailsButton"),
  saveSourceDetails: document.querySelector("#saveSourceDetailsButton"),
  copyFull: document.querySelector("#copyFullButton"),
  copyTextInText: document.querySelector("#copyInTextButton"),
  editSelected: document.querySelector("#editSelectedButton"),
  moveSelected: document.querySelector("#moveSelectedButton"),
  deleteSelected: document.querySelector("#deleteSelectedButton"),
  copySelected: document.querySelector("#copySelectedButton"),
  clearHistory: document.querySelector("#clearHistoryButton"),
  newProject: document.querySelector("#newProjectButton"),
  renameProject: document.querySelector("#renameProjectButton"),
  deleteProject: document.querySelector("#deleteProjectButton"),
  copyBibliography: document.querySelector("#copyBibliographyButton"),
  exportTxt: document.querySelector("#exportTxtButton"),
  exportPdf: document.querySelector("#exportPdfButton"),
  exportDocx: document.querySelector("#exportDocxButton"),
  minimizeSidebar: document.querySelector("#minimizeSidebarButton"),
  closeSidebar: document.querySelector("#closeSidebarButton"),
  useActiveTab: document.querySelector("#useActiveTabButton")
};

const HISTORY_SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "az", label: "A-Z" },
  { value: "za", label: "Z-A" }
];

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getSourceFromForm() {
  const copiedTextDoi = Security.extractDoi(elements.copiedText.value);

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
    url: copiedTextDoi || Security.sanitizeUrl(elements.sourceUrl.value),
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

function getCitationStyles() {
  return CitationGenerator.getCitationStyles ? CitationGenerator.getCitationStyles() : [];
}

function getCitationStyleLabel(styleValue) {
  return CitationGenerator.getCitationStyleLabel(styleValue);
}

function getCitationStyleValue(styleLabel) {
  return CitationGenerator.getCitationStyleValue(styleLabel);
}

function getBibliographyHeading(styleValue) {
  const style = getCitationStyleValue(styleValue);

  if (style === "mla") {
    return "Works Cited";
  }

  if (style === "chicago" || style === "chicago-notes" || style === "turabian") {
    return "Bibliography";
  }

  return "References";
}

function getProjectName(projectId) {
  if (projectId === ALL_PROJECTS_ID) {
    return "All Citations";
  }

  if (projectId === UNFILED_PROJECT_ID) {
    return "";
  }

  const project = State.projects.find((item) => item.id === projectId);
  return project ? project.name : "";
}

function getSafeProjectId(projectId) {
  if (projectId === ALL_PROJECTS_ID) {
    return projectId;
  }

  return State.projects.some((project) => project.id === projectId) ? projectId : ALL_PROJECTS_ID;
}

function getCitationProjectId(savedCitation) {
  if (!savedCitation || typeof savedCitation === "string") {
    return UNFILED_PROJECT_ID;
  }

  const projectId = savedCitation.projectId || UNFILED_PROJECT_ID;
  return State.projects.some((project) => project.id === projectId) ? projectId : UNFILED_PROJECT_ID;
}

function getProjectCitationCount(projectId, history = State.currentHistory) {
  if (projectId === ALL_PROJECTS_ID) {
    return history.length;
  }

  return history.filter((savedCitation) => getCitationProjectId(savedCitation) === projectId).length;
}

function getProjectFilteredHistory(projectId, history = State.currentHistory) {
  const safeProjectId = getSafeProjectId(projectId);

  if (safeProjectId === ALL_PROJECTS_ID) {
    return history;
  }

  return history.filter((savedCitation) => getCitationProjectId(savedCitation) === safeProjectId);
}

function createProjectId() {
  if (self.crypto && typeof self.crypto.randomUUID === "function") {
    return self.crypto.randomUUID();
  }

  return `project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeProjects(projects) {
  const seenNames = new Set();

  return (Array.isArray(projects) ? projects : [])
    .map((project) => ({
      id: Security.sanitizeText(project && project.id ? project.id : createProjectId(), 120),
      name: Security.sanitizeText(project && project.name ? project.name : "", 120),
      dateCreated: Security.sanitizeText(project && project.dateCreated ? project.dateCreated : new Date().toISOString(), 100)
    }))
    .filter((project) => {
      const nameKey = project.name.toLowerCase();

      if (!project.id || !project.name || seenNames.has(nameKey)) {
        return false;
      }

      seenNames.add(nameKey);
      return true;
    });
}

function getProjectSelectOptions(history = State.currentHistory) {
  return [
    {
      id: ALL_PROJECTS_ID,
      name: "All Citations",
      count: getProjectCitationCount(ALL_PROJECTS_ID, history)
    },
    ...State.projects.map((project) => ({
      id: project.id,
      name: project.name,
      count: getProjectCitationCount(project.id, history)
    }))
  ];
}

function getMoveFolderOptions(history = State.currentHistory) {
  return [
    {
      id: UNFILED_PROJECT_ID,
      name: "All Citations",
      count: getProjectCitationCount(UNFILED_PROJECT_ID, history)
    },
    ...State.projects.map((project) => ({
      id: project.id,
      name: project.name,
      count: getProjectCitationCount(project.id, history)
    }))
  ];
}

function renderProjectSelect(selectElement, selectedId, history = State.currentHistory) {
  if (!selectElement) {
    return;
  }

  selectElement.replaceChildren();
  getProjectSelectOptions(history).forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = `${project.name} (${project.count})`;
    selectElement.appendChild(option);
  });
  selectElement.value = getSafeProjectId(selectedId);
}

function renderProjectDropdown({ selectedId, selectedElement, optionsElement, menuElement, onSelect }, history = State.currentHistory) {
  if (!selectedElement || !optionsElement) {
    return;
  }

  const safeSelectedId = getSafeProjectId(selectedId);
  const options = getProjectSelectOptions(history);
  const selectedProject = options.find((project) => project.id === safeSelectedId) || options[0];

  selectedElement.textContent = selectedProject ? `${selectedProject.name} (${selectedProject.count})` : "All Citations";
  optionsElement.replaceChildren();

  options.forEach((project) => {
    const option = document.createElement("button");
    const isSelected = project.id === safeSelectedId;
    option.className = "compact-dropdown-option";
    option.type = "button";
    option.textContent = `${project.name} (${project.count})`;
    option.setAttribute("aria-selected", String(isSelected));
    option.classList.toggle("is-selected", isSelected);
    option.addEventListener("click", () => {
      if (menuElement) {
        menuElement.open = false;
      }
      onSelect(project.id);
    });
    optionsElement.appendChild(option);
  });
}

function renderProjectDropdowns(history = State.currentHistory) {
  renderProjectDropdown({
    selectedId: State.selectedProjectId,
    selectedElement: elements.projectFilterSelected,
    optionsElement: elements.projectFilterOptions,
    menuElement: elements.projectFilterMenu,
    onSelect: (projectId) => {
      State.selectedProjectId = getSafeProjectId(projectId);
      elements.projectFilter.value = State.selectedProjectId;
      State.selectedHistoryIndexes.clear();
      State.editingHistoryIndexes.clear();
      renderHistory(State.currentHistory);
    }
  }, history);

  renderProjectDropdown({
    selectedId: State.exportProjectId,
    selectedElement: elements.exportProjectFilterSelected,
    optionsElement: elements.exportProjectFilterOptions,
    menuElement: elements.exportProjectFilterMenu,
    onSelect: (projectId) => {
      State.exportProjectId = getSafeProjectId(projectId);
      elements.exportProjectFilter.value = State.exportProjectId;
      updateBibliographyPreview();
      renderProjectDropdowns(State.currentHistory);
    }
  }, history);
}

function renderMoveFolderSelect(history = State.currentHistory) {
  if (!elements.moveFolderSelect || !elements.moveFolderOptions) {
    return;
  }

  const currentValue = elements.moveFolderSelect.value || UNFILED_PROJECT_ID;
  const options = getMoveFolderOptions(history);

  elements.moveFolderSelect.replaceChildren();
  elements.moveFolderOptions.replaceChildren();
  options.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = `${project.name} (${project.count})`;
    elements.moveFolderSelect.appendChild(option);

    const moveButton = document.createElement("button");
    moveButton.className = "move-folder-option";
    moveButton.type = "button";
    moveButton.textContent = `${project.name} (${project.count})`;
    moveButton.addEventListener("click", () => {
      elements.moveFolderSelect.value = project.id;
      if (elements.moveFolderMenu) {
        elements.moveFolderMenu.open = false;
      }
      moveSelectedCitations();
    });
    elements.moveFolderOptions.appendChild(moveButton);
  });

  elements.moveFolderSelect.value = options.some((project) => project.id === currentValue)
    ? currentValue
    : UNFILED_PROJECT_ID;
}

function renderProjectControls() {
  State.selectedProjectId = getSafeProjectId(State.selectedProjectId);
  State.exportProjectId = getSafeProjectId(State.exportProjectId);
  renderProjectSelect(elements.projectFilter, State.selectedProjectId);
  renderProjectSelect(elements.exportProjectFilter, State.exportProjectId);
  renderProjectDropdowns();
  renderMoveFolderSelect();

  const selectedIsBuiltIn = State.selectedProjectId === ALL_PROJECTS_ID;
  buttons.renameProject.disabled = selectedIsBuiltIn;
  buttons.deleteProject.disabled = selectedIsBuiltIn;
}

function updateHistorySortButton() {
  if (!elements.historySortButton) {
    return;
  }

  const sort = HISTORY_SORT_OPTIONS.find((option) => option.value === elements.historySort.value) || HISTORY_SORT_OPTIONS[0];
  elements.historySortButton.textContent = sort.label;
  elements.historySortButton.title = `Sort citations: ${sort.label}`;
}

function cycleHistorySort() {
  const currentIndex = HISTORY_SORT_OPTIONS.findIndex((option) => option.value === elements.historySort.value);
  const nextOption = HISTORY_SORT_OPTIONS[(currentIndex + 1) % HISTORY_SORT_OPTIONS.length] || HISTORY_SORT_OPTIONS[0];
  elements.historySort.value = nextOption.value;
  updateHistorySortButton();
  renderHistory(State.currentHistory);
}

function setCitationStyle(styleValue, options = {}) {
  const safeStyleValue = getCitationStyleValue(styleValue);
  const style = CitationGenerator.getCitationStyle(safeStyleValue);

  elements.citationStyle.value = safeStyleValue;
  elements.citationStyleSelected.textContent = style.label;

  elements.citationStyleMenu.querySelectorAll(".style-dropdown-option").forEach((option) => {
    const isSelected = option.dataset.value === safeStyleValue;
    option.classList.toggle("is-selected", isSelected);
    option.setAttribute("aria-selected", String(isSelected));
  });

  if (options.persist) {
    Storage.storageSet({ [SELECTED_CITATION_STYLE_KEY]: safeStyleValue });
  }

  if (options.regenerate) {
    generateCitation();
    updateBibliographyPreview();
  }
}

function closeCitationStyleDropdown() {
  UI.removeClasses(elements.citationStyleDropdown, "is-open");
  elements.citationStyleButton.setAttribute("aria-expanded", "false");
}

function openCitationStyleDropdown() {
  UI.addClasses(elements.citationStyleDropdown, "is-open");
  elements.citationStyleButton.setAttribute("aria-expanded", "true");
}

function toggleCitationStyleDropdown() {
  if (elements.citationStyleDropdown.classList.contains("is-open")) {
    closeCitationStyleDropdown();
    return;
  }

  openCitationStyleDropdown();
}

function renderCitationStyleDropdown() {
  elements.citationStyleMenu.replaceChildren();

  getCitationStyles().forEach((style) => {
    const option = document.createElement("button");
    option.className = "style-dropdown-option";
    option.type = "button";
    option.dataset.value = style.value;
    option.id = `citation-style-option-${style.value}`;
    option.role = "option";
    option.textContent = style.label;
    option.addEventListener("click", () => {
      setCitationStyle(style.value, { persist: true, regenerate: true });
      closeCitationStyleDropdown();
      elements.citationStyleButton.focus();
    });
    elements.citationStyleMenu.appendChild(option);
  });

  setCitationStyle(elements.citationStyle.value || "apa");
}

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

function applyCitationNumber(styleValue, inTextCitation, citationIndex) {
  const style = CitationGenerator.getCitationStyle(styleValue);

  if (!style || (style.bibliography !== "numbered" && style.inText !== "numbered")) {
    return inTextCitation;
  }

  const numberText = String(citationIndex + 1);
  return inTextCitation.replace("#", numberText);
}

function getRequiredFieldStatus(source) {
  const hasAuthorName = Contributors.getAuthorContributors(source.contributors).some((contributor) => {
    return contributor.organizationName || (contributor.firstName && contributor.lastName);
  });
  const hasOrganization = Boolean(Contributors.getOrganizationContributor(source.contributors));

  return {
    title: {
      complete: Boolean(source.title),
      label: "Title"
    },
    author: {
      complete: hasAuthorName || hasOrganization,
      label: "Author",
      missingText: "Missing author. Add a person or organization."
    },
    date: {
      label: "Date",
      complete: Boolean(source.publishedDate),
      missingText: "Missing date. Use n.d. if unavailable."
    },
    publisher: {
      label: "Publisher",
      complete: Boolean(source.publisher),
      missingText: "Missing publisher or organization."
    },
    url: {
      label: "URL or DOI",
      complete: Boolean(source.url),
      missingText: "Missing URL or DOI."
    }
  };
}

function updateFieldStatuses(source) {
  const statuses = getRequiredFieldStatus(source);

  document.querySelectorAll(".contributor-card").forEach((card) => {
    Contributors.updateContributorCardFields(card);
  });

  document.querySelectorAll("[data-status-for]").forEach((statusElement) => {
    const status = statuses[statusElement.dataset.statusFor];

    if (!status) {
      return;
    }

    statusElement.className = `field-status ${status.complete ? "is-complete" : "is-missing"}`;
    statusElement.textContent = status.complete ? `${status.label} added.` : status.missingText || `Missing ${status.label.toLowerCase()}.`;
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
    return contributor.organizationName || (contributor.firstName && contributor.lastName);
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
  citation.inText = applyCitationNumber(elements.citationStyle.value, citation.inText, State.currentHistory.length);

  updateFieldStatuses(source);
  renderValidationWarnings(getValidationWarnings(source, citation));

  if (elements.manualOverride.checked) {
    return;
  }

  elements.fullCitation.value = citation.full;
  elements.inTextCitation.value = citation.inText;
  UI.animateCitationFields([elements.fullCitation, elements.inTextCitation]);
}

function setSourceScanStatus(message, type = "info") {
  if (!elements.sourceScanStatus) {
    return;
  }

  elements.sourceScanStatus.textContent = Security.sanitizeText(message, 180);
  elements.sourceScanStatus.dataset.type = type;
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getActiveTabContextAsync() {
  return new Promise((resolve) => {
    Metadata.getActiveTabContext((activeTabContext) => {
      resolve(activeTabContext || null);
    });
  });
}

function getActivePageDetailsAsync() {
  return new Promise((resolve) => {
    Metadata.getActivePageDetails(resolve, () => resolve(null));
  });
}

function sourceHasEnoughDetails(details) {
  const source = Security.sanitizeSourceDetails(details);
  const hasTitle = Boolean(source.title);
  const hasLocation = Boolean(source.url || source.website || source.publisher || source.journalName);
  const hasCreatorOrDate = Boolean(source.author || source.publishedDate || source.publisher || source.website || source.journalName);

  return hasTitle && hasLocation && hasCreatorOrDate;
}

function isLikelyPdfContext(activeTabContext) {
  const url = Security.sanitizeUrl(activeTabContext && activeTabContext.url ? activeTabContext.url : "");
  const cleanUrl = url.toLowerCase().split(/[?#]/)[0];
  const title = Security.sanitizeText(activeTabContext && activeTabContext.title ? activeTabContext.title : "");

  return cleanUrl.endsWith(".pdf") || /\.pdf$/i.test(title);
}

function getSourceScanUnavailableMessage(activeTabContext) {
  const url = activeTabContext && activeTabContext.url ? String(activeTabContext.url) : "";

  if (/^file:/i.test(url)) {
    return "AutoCite cannot read local file tabs directly. Enter the source details manually.";
  }

  return activeTabContext && activeTabContext.reason
    ? activeTabContext.reason
    : "AutoCite cannot read this source. Enter the details manually or try an http/https page.";
}

async function scanCurrentSourceForCitation() {
  buttons.citeSource.disabled = true;
  setSourceScanStatus("Reading source...");
  UI.showMessage("Reading source...", "info");

  try {
    const activeTabContext = await getActiveTabContextAsync();
    const sourceUrl = Security.sanitizeUrl(activeTabContext && activeTabContext.url ? activeTabContext.url : "");

    if (!activeTabContext || (!activeTabContext.canAccess && !sourceUrl)) {
      const message = getSourceScanUnavailableMessage(activeTabContext);
      setSourceScanStatus(message, "error");
      UI.showMessage(message, "warning");
      return;
    }

    if (!sourceUrl) {
      setSourceScanStatus("");
      return;
    }

    await delay(180);
    setSourceScanStatus("Extracting citation details...");
    UI.showMessage("Extracting citation details...", "info");

    let pageDetails = null;
    let sourceDetails = null;

    if (activeTabContext.connected && !isLikelyPdfContext(activeTabContext)) {
      pageDetails = await getActivePageDetailsAsync();
      sourceDetails = pageDetails && pageDetails.sourceDetails;
    }

    if (!sourceHasEnoughDetails(sourceDetails)) {
      if (Metadata.requestUrlScanPermission) {
        const permissionGranted = await Metadata.requestUrlScanPermission(sourceUrl);

        if (!permissionGranted) {
          elements.sourceUrl.value = sourceUrl;
          generateCitation();
          const message = "Site access was not granted. Open the source in this tab or edit the details manually.";
          setSourceScanStatus(message, "error");
          UI.showMessage(message, "warning");
          return;
        }
      }

      try {
        sourceDetails = await Metadata.scanUrlDetails(sourceUrl);
      } finally {
        if (Metadata.releaseUrlScanPermission) {
          await Metadata.releaseUrlScanPermission(sourceUrl);
        }
      }
    }

    if (!sourceHasEnoughDetails(sourceDetails)) {
      if (sourceDetails) {
        fillSourceDetails(sourceDetails);
      }

      const message = "I could not extract enough citation details. Open Source Details to add the missing fields.";
      setSourceScanStatus(message, "error");
      UI.showMessage(message, "warning");
      return;
    }

    await delay(180);
    setSourceScanStatus("Generating citation...");
    UI.showMessage("Generating citation...", "info");
    elements.manualOverride.checked = false;

    if (pageDetails && pageDetails.selectedText) {
      elements.copiedText.value = Security.sanitizeCopiedText(pageDetails.selectedText);
    } else if (!Security.sanitizeCopiedText(elements.copiedText.value)) {
      elements.copiedText.value = sourceUrl;
    }

    fillSourceDetails(sourceDetails);
    Storage.storageSet({
      latestCopiedSource: null,
      latestSelectedText: Security.sanitizeCopiedText(elements.copiedText.value)
    });
    setSourceScanStatus("Citation ready.", "success");
    UI.showMessage("Citation ready!", "success");
  } catch (error) {
    console.warn("[AutoCite] Source scan failed.", error);
    const message = "AutoCite could not read enough details from this source.";
    setSourceScanStatus(message, "error");
    UI.showMessage(message, "warning");
  } finally {
    buttons.citeSource.disabled = false;
  }
}

function regenerateFromContributorEdit() {
  elements.manualOverride.checked = false;
  generateCitation();
}

function fillSourceDetails(details) {
  const sourceDetails = Security.sanitizeSourceDetails(details);
  const copiedTextDoi = Security.extractDoi(elements.copiedText.value);

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
  elements.sourceUrl.value = copiedTextDoi || sourceDetails.url || "";
  elements.publishedDate.value = sourceDetails.publishedDate || "";
  elements.accessDate.value = sourceDetails.accessDate || getTodayDate();
  generateCitation();
}

function fillCopiedSource(copiedSource, showUpdatedToast = false) {
  if (!copiedSource) {
    return;
  }

  const safeCopiedSource = Security.sanitizeCopiedSource(copiedSource);
  const copiedTextDoi = Security.extractDoi(safeCopiedSource.copiedText);
  const sourceDetails = {
    ...safeCopiedSource.sourceDetails,
    url: copiedTextDoi || safeCopiedSource.sourceDetails.url
  };
  const copiedUrl = getFirstHttpUrl(safeCopiedSource.copiedText);
  elements.manualOverride.checked = false;
  elements.copiedText.value = safeCopiedSource.copiedText;
  fillSourceDetails(sourceDetails);

  if (copiedUrl && isOnlyHttpUrl(safeCopiedSource.copiedText) && showUpdatedToast) {
    scanSourceFromUrl(copiedUrl);
    return;
  }

  if (showUpdatedToast) {
    UI.showMessage("Updated!", "success");
  }
}

function getFirstHttpUrl(text) {
  const value = Security.sanitizeText(text);
  const cleanUrlCandidate = (urlText) => Security.sanitizeUrl(
    Security.sanitizeText(urlText)
      .replace(/^[<("'`]+/, "")
      .replace(/[>)"'`,.;:!?]+$/, "")
  );
  const directUrl = cleanUrlCandidate(value);

  if (directUrl) {
    return directUrl;
  }

  const match = value.match(/https?:\/\/[^\s<>"']+/i);
  return match ? cleanUrlCandidate(match[0]) : "";
}

function isOnlyHttpUrl(text) {
  return /^<?https?:\/\/\S+>?$/i.test(Security.sanitizeText(text).trim());
}

async function scanSourceFromUrl(url) {
  const safeUrl = Security.sanitizeUrl(url);

  if (!safeUrl) {
    return false;
  }

  if (Metadata.requestUrlScanPermission) {
    const permissionGranted = await Metadata.requestUrlScanPermission(safeUrl);

    if (!permissionGranted) {
      elements.sourceUrl.value = safeUrl;
      generateCitation();
      UI.showMessage("Site access was not granted. Open the link in this tab or enter details manually.", "warning");
      return false;
    }
  }

  UI.showMessage("Scanning link...", "info");
  let sourceDetails = null;

  try {
    sourceDetails = await Metadata.scanUrlDetails(safeUrl);
  } finally {
    if (Metadata.releaseUrlScanPermission) {
      await Metadata.releaseUrlScanPermission(safeUrl);
    }
  }

  if (!sourceDetails) {
    elements.copiedText.value = safeUrl;
    elements.sourceUrl.value = safeUrl;
    generateCitation();
    UI.showMessage("Open that link in this tab, then try again.", "warning");
    return false;
  }

  elements.manualOverride.checked = false;
  elements.copiedText.value = safeUrl;
  Storage.storageSet({ latestCopiedSource: null, latestSelectedText: safeUrl });
  fillSourceDetails(sourceDetails);
  UI.showMessage("Link scanned!", "success");
  return true;
}

function handleCopiedTextPaste(event) {
  const pastedText = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
  const url = getFirstHttpUrl(pastedText);

  if (!url) {
    window.setTimeout(handleCopiedTextChange, 0);
    return;
  }

  event.preventDefault();
  scanSourceFromUrl(url);
}

function handleCopiedTextChange() {
  const value = Security.sanitizeText(elements.copiedText.value);
  const doi = Security.extractDoi(value);
  const url = getFirstHttpUrl(value);

  if (doi) {
    elements.sourceUrl.value = doi;
    generateCitation();
    return;
  }

  if (url && isOnlyHttpUrl(value)) {
    scanSourceFromUrl(url);
  }
}

function handleSourceUrlPaste(event) {
  const pastedText = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
  const url = getFirstHttpUrl(pastedText);

  if (!url) {
    window.setTimeout(handleSourceUrlChange, 0);
    return;
  }

  event.preventDefault();
  elements.sourceUrl.value = url;
  scanSourceFromUrl(url);
}

function handleSourceUrlChange() {
  const value = Security.sanitizeText(elements.sourceUrl.value);
  const doi = Security.extractDoi(value);
  const url = getFirstHttpUrl(value);

  if (doi) {
    elements.sourceUrl.value = doi;
    generateCitation();
    return;
  }

  if (url && isOnlyHttpUrl(value)) {
    scanSourceFromUrl(url);
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

function formatTabLabel(activeTabContext) {
  if (!activeTabContext) {
    return "Current tab unavailable";
  }

  return activeTabContext.title || activeTabContext.hostname || activeTabContext.url || "Current tab";
}

function renderActiveTabStatus(activeTabContext) {
  const connected = Boolean(activeTabContext && activeTabContext.connected);
  const canAccess = Boolean(activeTabContext && activeTabContext.canAccess);
  const tabLabel = Security.sanitizeText(formatTabLabel(activeTabContext), 180);

  elements.activeTabStatus.className = `tab-connection ${connected ? "is-connected" : "is-warning"}`;
  elements.activeTabStatusTitle.textContent = connected ? `Connected to: ${tabLabel}` : "Not connected to this tab";
  elements.activeTabStatusDetails.textContent = connected
    ? ""
    : Security.sanitizeText(activeTabContext && activeTabContext.reason ? activeTabContext.reason : "Switch to a webpage or reconnect before citing.", 220);
  UI.toggleClass(elements.activeTabStatusDetails, "is-hidden", connected);
  UI.toggleClass(buttons.useActiveTab, "is-hidden", connected || activeTabContext === null || canAccess === false);
}

function refreshActiveTabStatus() {
  Metadata.getActiveTabContext(renderActiveTabStatus);
}

function loadPageDetails({ preserveSavedSelection = true } = {}) {
  refreshActiveTabStatus();

  Metadata.getActivePageDetails((response) => {
    if (response && response.pageContext) {
      renderActiveTabStatus({
        ...response.pageContext,
        connected: true,
        canAccess: true,
        hostname: (() => {
          try {
            return new URL(response.pageContext.url).hostname.replace(/^www\./, "");
          } catch (error) {
            return "";
          }
        })()
      });
    }

    fillSourceDetails(response && response.sourceDetails);

    if (response && response.selectedText) {
      elements.copiedText.value = Security.sanitizeCopiedText(response.selectedText);
    } else if (preserveSavedSelection) {
      loadSavedSelection();
    }
  }, () => {
    if (preserveSavedSelection) {
      loadSavedSelection();
    }
  });
}

function useActiveTab() {
  UI.showMessage("Connecting tab...", "info");

  Metadata.useActiveTab((response) => {
    const activeTabContext = response && response.activeTabContext;
    renderActiveTabStatus(activeTabContext);

    if (response && response.connected) {
      loadPageDetails({ preserveSavedSelection: false });
      UI.showMessage("Tab connected!", "success");
      return;
    }

    UI.showMessage("Click the AutoCite toolbar icon if this page does not connect.", "warning");
  });
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
  elements.manualOverride.checked = false;
  elements.fullCitation.value = "";
  elements.inTextCitation.value = "";
  elements.validationWarnings.replaceChildren();
  setSourceScanStatus("");
  updateFieldStatuses(getSourceFromForm());
  Storage.storageSet({ latestCopiedSource: null, latestSelectedText: "" });
  Metadata.sendMessageToActiveTab({ type: "CLEAR_AUTOCITE_SELECTION" });
  UI.showMessage(message, "success");
}

function setSourceDetailsExpanded(expanded) {
  UI.toggleClass(elements.sourceDetailsFields, "is-hidden", !expanded);
  buttons.toggleSourceDetails.setAttribute("aria-expanded", String(expanded));
  buttons.toggleSourceDetails.textContent = expanded ? "Hide Source Details" : "Edit Source Details";
}

function toggleSourceDetails() {
  setSourceDetailsExpanded(elements.sourceDetailsFields.classList.contains("is-hidden"));
}

function saveSourceDetails() {
  elements.manualOverride.checked = false;
  generateCitation();
  setSourceDetailsExpanded(false);
  UI.showMessage("Source details saved.", "success");
}

function clearCitationHistory() {
  const clearingAll = State.selectedProjectId === ALL_PROJECTS_ID;
  const projectName = clearingAll ? "all saved citations" : `citations in "${getProjectName(State.selectedProjectId)}"`;
  const confirmationMessage = `Are you sure you want to clear ${projectName}? This cannot be undone.`;

  if (!window.confirm(confirmationMessage)) {
    return;
  }

  State.selectedHistoryIndexes.clear();
  State.editingHistoryIndexes.clear();

  const updatedHistory = clearingAll
    ? []
    : State.currentHistory.filter((savedCitation) => getCitationProjectId(savedCitation) !== State.selectedProjectId);

  Storage.storageSet({ citationHistory: updatedHistory }, () => {
    renderHistory(updatedHistory);
    UI.showMessage("Cleared!", "success");
  });
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
    website: Security.sanitizeText(elements.sourceWebsite.value),
    journalName: Security.sanitizeText(elements.journalName.value),
    volume: Security.sanitizeText(elements.sourceVolume.value, 100),
    issue: Security.sanitizeText(elements.sourceIssue.value, 100),
    pages: Security.sanitizeText(elements.sourcePages.value, 100),
    sourceTitle: Security.sanitizeText(elements.sourceTitle.value),
    url: Security.sanitizeUrl(elements.sourceUrl.value),
    publishedDate: Security.sanitizeText(elements.publishedDate.value, 100),
    accessDate: elements.accessDate.value || getTodayDate(),
    citationStyle: getCitationStyleLabel(elements.citationStyle.value),
    citationStyleValue: elements.citationStyle.value,
    projectId: State.selectedProjectId === ALL_PROJECTS_ID ? UNFILED_PROJECT_ID : getSafeProjectId(State.selectedProjectId),
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
    if (State.selectedProjectId === ALL_PROJECTS_ID) {
      State.selectedProjectId = savedCitation.projectId;
      renderProjectControls();
      renderHistory(newHistory);
    }
    clearCitationForm("Saved!");
  });
}

function saveProjects(callback = () => {}) {
  Storage.storageSet({ [CITATION_PROJECTS_KEY]: State.projects }, callback);
}

function createProject() {
  const projectName = Security.sanitizeText(window.prompt("Project name, class, essay, or assignment:"), 120);

  if (!projectName) {
    return;
  }

  const duplicate = State.projects.some((project) => project.name.toLowerCase() === projectName.toLowerCase());

  if (duplicate) {
    UI.showMessage("A project with that name already exists.", "warning");
    return;
  }

  const project = {
    id: createProjectId(),
    name: projectName,
    dateCreated: new Date().toISOString()
  };

  State.projects = [...State.projects, project];
  State.selectedProjectId = project.id;
  State.exportProjectId = project.id;
  saveProjects(() => {
    renderProjectControls();
    renderHistory(State.currentHistory);
    UI.showMessage("Project created.", "success");
  });
}

function renameSelectedProject() {
  const project = State.projects.find((item) => item.id === State.selectedProjectId);

  if (!project) {
    UI.showMessage("Choose a project to rename.", "warning");
    return;
  }

  const newName = Security.sanitizeText(window.prompt("New project name:", project.name), 120);

  if (!newName || newName === project.name) {
    return;
  }

  const duplicate = State.projects.some((item) => item.id !== project.id && item.name.toLowerCase() === newName.toLowerCase());

  if (duplicate) {
    UI.showMessage("A project with that name already exists.", "warning");
    return;
  }

  State.projects = State.projects.map((item) => item.id === project.id ? { ...item, name: newName } : item);
  saveProjects(() => {
    renderProjectControls();
    updateBibliographyPreview();
    UI.showMessage("Project renamed.", "success");
  });
}

function deleteSelectedProject() {
  const project = State.projects.find((item) => item.id === State.selectedProjectId);

  if (!project) {
    UI.showMessage("Choose a project to delete.", "warning");
    return;
  }

  const citationCount = getProjectCitationCount(project.id);
  const shouldDeleteCitations = citationCount > 0 && window.confirm(
    `Delete "${project.name}" and its ${citationCount} saved citation${citationCount === 1 ? "" : "s"}? Select Cancel to keep the citations and move them to Unfiled.`
  );

  if (citationCount > 0 && !shouldDeleteCitations && !window.confirm(`Keep citations from "${project.name}" and move them to Unfiled?`)) {
    return;
  }

  State.projects = State.projects.filter((item) => item.id !== project.id);
  const updatedHistory = shouldDeleteCitations
    ? State.currentHistory.filter((savedCitation) => getCitationProjectId(savedCitation) !== project.id)
    : State.currentHistory.map((savedCitation) => {
      if (typeof savedCitation === "string" || getCitationProjectId(savedCitation) !== project.id) {
        return savedCitation;
      }

      return { ...savedCitation, projectId: UNFILED_PROJECT_ID };
    });

  State.selectedProjectId = ALL_PROJECTS_ID;
  State.exportProjectId = State.exportProjectId === project.id ? ALL_PROJECTS_ID : State.exportProjectId;
  State.selectedHistoryIndexes.clear();
  State.editingHistoryIndexes.clear();

  Storage.storageSet({ [CITATION_PROJECTS_KEY]: State.projects, citationHistory: updatedHistory }, () => {
    renderProjectControls();
    renderHistory(updatedHistory);
    UI.showMessage(shouldDeleteCitations ? "Project and citations deleted." : "Project deleted. Citations moved to Unfiled.", "success");
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

function citationMatchesSelectedProject(savedCitation) {
  return State.selectedProjectId === ALL_PROJECTS_ID || getCitationProjectId(savedCitation) === State.selectedProjectId;
}

function syncSelectionWithVisibleEntries(visibleEntries) {
  const visibleIndexes = new Set(visibleEntries.map(({ index }) => index));

  State.selectedHistoryIndexes.forEach((index) => {
    if (!visibleIndexes.has(index)) {
      State.selectedHistoryIndexes.delete(index);
      State.editingHistoryIndexes.delete(index);
    }
  });
}

function renderHistory(history) {
  const safeHistory = Array.isArray(history) ? history : [];
  State.currentHistory = safeHistory;
  renderProjectControls();
  updateHistorySortButton();
  updateBibliographyPreview();
  elements.citationHistory.replaceChildren();

  if (!safeHistory.length) {
    State.selectedHistoryIndexes.clear();
    State.editingHistoryIndexes.clear();
    updateSelectionActions();
    elements.citationHistory.appendChild(UI.createTextElement("li", "No saved citations yet.", "empty-history"));
    return;
  }

  const visibleEntries = HistoryTools.getSortedHistoryEntries(safeHistory, elements.historySort.value)
    .filter(({ savedCitation }) => citationMatchesSelectedProject(savedCitation))
    .filter(({ savedCitation }) => citationMatchesCurrentSearch(savedCitation));

  syncSelectionWithVisibleEntries(visibleEntries);
  updateSelectionActions();

  if (!visibleEntries.length) {
    elements.citationHistory.appendChild(UI.createTextElement("li", State.selectedProjectId === ALL_PROJECTS_ID ? "No matching citations." : "No citations in this project yet.", "empty-history"));
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
      UI.createTextElement("p", formatHistoryMeta(savedCitation), "history-meta"),
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
  Storage.storageGet(["citationHistory", CITATION_PROJECTS_KEY], (result) => {
    State.projects = normalizeProjects(result[CITATION_PROJECTS_KEY]);
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

function formatHistoryMeta(savedCitation) {
  const projectName = getProjectName(getCitationProjectId(savedCitation));
  return [
    savedCitation.citationStyle || "Citation",
    projectName,
    formatDateCreated(savedCitation.dateCreated)
  ].filter(Boolean).join(" - ");
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

function createHistoryEditInput(className, type = "text") {
  const input = document.createElement("input");
  input.className = className;
  input.type = type;
  return input;
}

function getSourceFromSavedCitation(savedCitation, form) {
  const contributorsList = form && form.querySelector(".edit-contributors-list");

  return {
    sourceType: form ? form.querySelector(".edit-source-type").value : savedCitation.sourceType || "website",
    contributors: contributorsList ? Contributors.getContributorsFromForm(contributorsList) : savedCitation.contributors || [],
    title: form ? Security.sanitizeText(form.querySelector(".edit-title").value) : savedCitation.sourceTitle || "",
    website: form ? Security.sanitizeText(form.querySelector(".edit-website").value) : savedCitation.website || "",
    publisher: form ? Security.sanitizeText(form.querySelector(".edit-publisher").value) : savedCitation.publisher || "",
    journalName: form ? Security.sanitizeText(form.querySelector(".edit-journal").value) : savedCitation.journalName || "",
    volume: form ? Security.sanitizeText(form.querySelector(".edit-volume").value, 100) : savedCitation.volume || "",
    issue: form ? Security.sanitizeText(form.querySelector(".edit-issue").value, 100) : savedCitation.issue || "",
    pages: form ? Security.sanitizeText(form.querySelector(".edit-pages").value, 100) : savedCitation.pages || "",
    url: form ? Security.sanitizeUrl(form.querySelector(".edit-url").value) : savedCitation.url || "",
    publishedDate: form ? Security.sanitizeText(form.querySelector(".edit-date").value, 100) : savedCitation.publishedDate || "",
    accessDate: form ? Security.sanitizeText(form.querySelector(".edit-access-date").value, 100) || getTodayDate() : savedCitation.accessDate || getTodayDate()
  };
}

function regenerateEditedCitation(form, savedCitation, index) {
  const styleValue = form.querySelector(".edit-style").value;
  const source = getSourceFromSavedCitation(savedCitation, form);
  const citation = CitationGenerator.generateCitationForSource(styleValue, source);
  citation.inText = applyCitationNumber(styleValue, citation.inText, index);
  form.querySelector(".edit-full").value = citation.full;
  form.querySelector(".edit-in-text").value = citation.inText;
}

function addHistoryEditForm(listItem, savedCitation, index) {
  const form = document.createElement("div");
  form.className = "history-edit-form";

  const sourceTypeSelect = document.createElement("select");
  sourceTypeSelect.className = "edit-source-type";
  [
    ["website", "Website"],
    ["pdf", "PDF"],
    ["book", "Book"],
    ["journal", "Journal Article"]
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    sourceTypeSelect.appendChild(option);
  });

  const titleInput = createHistoryEditInput("edit-title");
  const websiteInput = createHistoryEditInput("edit-website");
  const publisherInput = createHistoryEditInput("edit-publisher");
  const journalInput = createHistoryEditInput("edit-journal");
  const volumeInput = createHistoryEditInput("edit-volume");
  const issueInput = createHistoryEditInput("edit-issue");
  const pagesInput = createHistoryEditInput("edit-pages");
  const dateInput = createHistoryEditInput("edit-date");
  const urlInput = createHistoryEditInput("edit-url");
  const accessDateInput = createHistoryEditInput("edit-access-date", "date");
  const contributorsWrap = document.createElement("div");
  contributorsWrap.className = "history-edit-contributors contributors-section";
  const contributorsHeader = document.createElement("div");
  contributorsHeader.className = "section-heading contributors-heading";
  contributorsHeader.append(
    UI.createTextElement("h3", "Contributors"),
    createHistoryEditButton("small-button secondary-button edit-add-contributor", "Add contributor")
  );
  const contributorsList = document.createElement("div");
  contributorsList.className = "contributors-list edit-contributors-list";
  contributorsWrap.append(contributorsHeader, contributorsList);

  const styleSelect = document.createElement("select");
  styleSelect.className = "edit-style";
  getCitationStyles().forEach((style) => {
    const option = document.createElement("option");
    option.value = style.value;
    option.textContent = style.label;
    styleSelect.appendChild(option);
  });

  const fullCitation = document.createElement("textarea");
  fullCitation.className = "edit-full";
  const inTextCitation = document.createElement("input");
  inTextCitation.className = "edit-in-text";
  inTextCitation.type = "text";
  const copiedText = document.createElement("textarea");
  copiedText.className = "edit-copied-text";
  const copyActions = document.createElement("div");
  copyActions.className = "history-edit-copy-actions";
  copyActions.append(
    createHistoryEditButton("secondary-button edit-copy-text-in-text", "Copy Text + In-text Citation"),
    createHistoryEditButton("secondary-button edit-copy-full", "Copy Full Citation")
  );

  form.append(
    createHistoryEditField("Source type", sourceTypeSelect),
    createHistoryEditField("Source title", titleInput),
    contributorsWrap,
    createHistoryEditField("Website name", websiteInput),
    createHistoryEditField("Publisher or organization", publisherInput),
    createHistoryEditField("Journal name", journalInput),
    createHistoryEditField("Volume", volumeInput),
    createHistoryEditField("Issue", issueInput),
    createHistoryEditField("Pages", pagesInput),
    createHistoryEditField("Published date", dateInput),
    createHistoryEditField("URL or DOI", urlInput),
    createHistoryEditField("Access date", accessDateInput),
    createHistoryEditField("Citation style", styleSelect),
    createHistoryEditField("Full citation", fullCitation),
    createHistoryEditField("In-text citation", inTextCitation),
    createHistoryEditField("Original copied text", copiedText),
    copyActions
  );

  form.querySelector(".edit-source-type").value = savedCitation.sourceType || "website";
  form.querySelector(".edit-title").value = savedCitation.sourceTitle || "";
  form.querySelector(".edit-website").value = savedCitation.website || "";
  form.querySelector(".edit-publisher").value = savedCitation.publisher || "";
  form.querySelector(".edit-journal").value = savedCitation.journalName || "";
  form.querySelector(".edit-volume").value = savedCitation.volume || "";
  form.querySelector(".edit-issue").value = savedCitation.issue || "";
  form.querySelector(".edit-pages").value = savedCitation.pages || "";
  form.querySelector(".edit-date").value = savedCitation.publishedDate || "";
  form.querySelector(".edit-access-date").value = savedCitation.accessDate || getTodayDate();
  form.querySelector(".edit-style").value = getCitationStyleValue(savedCitation.citationStyle);
  form.querySelector(".edit-full").value = savedCitation.fullCitation || "";
  form.querySelector(".edit-in-text").value = savedCitation.inTextCitation || "";
  form.querySelector(".edit-url").value = savedCitation.url || "";
  form.querySelector(".edit-copied-text").value = savedCitation.copiedText || "";

  Contributors.setContributors(
    contributorsList,
    savedCitation.contributors && savedCitation.contributors.length ? savedCitation.contributors : [Contributors.createEmptyContributor()],
    () => {}
  );

  listen(form.querySelector(".edit-add-contributor"), "click", () => {
    Contributors.renderContributor(contributorsList, Contributors.createEmptyContributor(), () => {});
  });

  const saveButton = document.createElement("button");
  saveButton.className = "primary-button history-edit-save";
  saveButton.type = "button";
  saveButton.textContent = "Save Changes";
  listen(saveButton, "click", () => {
    regenerateEditedCitation(form, savedCitation, State.currentHistory.length - index - 1);
    saveEditedCitation(index, listItem);
  });

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
    const citationText = form.querySelector(".edit-full").value;
    const source = getSourceFromSavedCitation(savedCitation, form);
    const styleValue = form.querySelector(".edit-style").value;
    const citationHtml = ExportTools.createHangingIndentHtml
      ? ExportTools.createHangingIndentHtml(citationText, { source, styleValue })
      : "";
    const citationRtf = ExportTools.createHangingIndentRtf
      ? ExportTools.createHangingIndentRtf(citationText, { source, styleValue })
      : "";
    CopyActions.copyText(citationText, "full citation", UI.showMessage, { html: citationHtml, rtf: citationRtf });
  });

  form.append(saveButton, cancelButton);
  listItem.appendChild(form);
}

function saveEditedCitation(index, listItem) {
  const savedCitation = State.currentHistory[index];
  const form = listItem.querySelector(".history-edit-form");
  const source = getSourceFromSavedCitation(savedCitation, form);
  const authorText = Contributors.getAuthorContributors(source.contributors).map(Contributors.formatFullName).filter(Boolean).join(", ");
  const organizationContributor = Contributors.getOrganizationContributor(source.contributors);
  const updatedCitation = {
    ...savedCitation,
    sourceType: source.sourceType,
    contributors: source.contributors,
    author: Security.sanitizeText(authorText),
    organization: Security.sanitizeText(organizationContributor ? organizationContributor.organizationName : source.website),
    sourceTitle: source.title,
    website: source.website,
    publisher: source.publisher,
    journalName: source.journalName,
    volume: source.volume,
    issue: source.issue,
    pages: source.pages,
    publishedDate: source.publishedDate,
    accessDate: source.accessDate,
    citationStyle: getCitationStyleLabel(form.querySelector(".edit-style").value),
    citationStyleValue: form.querySelector(".edit-style").value,
    fullCitation: Security.sanitizeCopiedText(listItem.querySelector(".edit-full").value),
    inTextCitation: Security.sanitizeText(listItem.querySelector(".edit-in-text").value),
    url: source.url,
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

function getSafeMoveProjectId(projectId) {
  if (projectId === UNFILED_PROJECT_ID) {
    return UNFILED_PROJECT_ID;
  }

  return State.projects.some((project) => project.id === projectId) ? projectId : UNFILED_PROJECT_ID;
}

function moveSelectedCitations() {
  if (!State.selectedHistoryIndexes.size) {
    UI.showMessage("Select a citation first.", "warning");
    return;
  }

  const destinationProjectId = getSafeMoveProjectId(elements.moveFolderSelect.value);
  const selectedIndexes = new Set(State.selectedHistoryIndexes);
  let movedCount = 0;

  const updatedHistory = State.currentHistory.map((savedCitation, index) => {
    if (!selectedIndexes.has(index) || typeof savedCitation === "string") {
      return savedCitation;
    }

    movedCount += 1;
    return {
      ...savedCitation,
      projectId: destinationProjectId
    };
  });

  if (!movedCount) {
    UI.showMessage("Select a citation first.", "warning");
    return;
  }

  State.selectedHistoryIndexes.clear();
  State.editingHistoryIndexes.clear();

  Storage.storageSet({ citationHistory: updatedHistory }, () => {
    State.selectedProjectId = destinationProjectId === UNFILED_PROJECT_ID ? ALL_PROJECTS_ID : destinationProjectId;
    elements.projectFilter.value = State.selectedProjectId;
    renderHistory(updatedHistory);
    UI.showMessage(`Moved ${movedCount} citation${movedCount === 1 ? "" : "s"} to ${destinationProjectId === UNFILED_PROJECT_ID ? "All Citations" : getProjectName(destinationProjectId)}.`, "success");
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

  const selectedText = ExportTools.getBibliographyText(selectedCitations, elements.citationStyle.value);
  const selectedHtml = ExportTools.getBibliographyHtml
    ? ExportTools.getBibliographyHtml(selectedCitations, elements.citationStyle.value, { includeHeading: false })
    : "";
  const selectedRtf = ExportTools.getBibliographyRtf
    ? ExportTools.getBibliographyRtf(selectedCitations, elements.citationStyle.value, { includeHeading: false })
    : "";
  CopyActions.copyText(selectedText, "selected citations", UI.showMessage, { html: selectedHtml, rtf: selectedRtf });
}

function renderBibliographyPreviewDisplay(heading, entries) {
  if (!elements.bibliographyPreviewDisplay) {
    return;
  }

  elements.bibliographyPreviewDisplay.replaceChildren();

  if (!entries.length) {
    elements.bibliographyPreviewDisplay.appendChild(
      UI.createTextElement("p", "Saved citations will appear here in alphabetical order...", "bibliography-preview-placeholder")
    );
    return;
  }

  elements.bibliographyPreviewDisplay.appendChild(
    UI.createTextElement("p", heading, "bibliography-preview-heading")
  );

  entries.forEach((entry) => {
    elements.bibliographyPreviewDisplay.appendChild(
      UI.createTextElement("p", entry, "bibliography-preview-entry")
    );
  });
}

function updateBibliographyPreview() {
  const heading = ExportTools.getBibliographyHeading
    ? ExportTools.getBibliographyHeading(elements.citationStyle.value)
    : getBibliographyHeading(elements.citationStyle.value);
  const exportHistory = getProjectFilteredHistory(State.exportProjectId);
  const bibliographyEntries = ExportTools.getBibliographyEntries(exportHistory, elements.citationStyle.value);
  const projectLabel = getProjectName(State.exportProjectId);
  elements.bibliographyHeading.textContent = `${heading} Preview`;
  elements.bibliographyCount.textContent = `${projectLabel}: ${bibliographyEntries.length} citation${bibliographyEntries.length === 1 ? "" : "s"}`;
  elements.bibliographyPreview.value = ExportTools.getBibliographyText(exportHistory, elements.citationStyle.value, { heading });
  renderBibliographyPreviewDisplay(heading, bibliographyEntries);
}

function copyBibliography() {
  updateBibliographyPreview();
  const exportHistory = getProjectFilteredHistory(State.exportProjectId);
  const heading = ExportTools.getBibliographyHeading
    ? ExportTools.getBibliographyHeading(elements.citationStyle.value)
    : getBibliographyHeading(elements.citationStyle.value);
  const bibliographyHtml = ExportTools.getBibliographyHtml
    ? ExportTools.getBibliographyHtml(exportHistory, elements.citationStyle.value, { heading })
    : "";
  const bibliographyRtf = ExportTools.getBibliographyRtf
    ? ExportTools.getBibliographyRtf(exportHistory, elements.citationStyle.value, { heading })
    : "";
  CopyActions.copyText(elements.bibliographyPreview.value, "bibliography", UI.showMessage, { html: bibliographyHtml, rtf: bibliographyRtf });
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
  const exportHistory = getProjectFilteredHistory(State.exportProjectId);
  const citationTexts = ExportTools.getBibliographyEntries(exportHistory, elements.citationStyle.value);
  const style = CitationGenerator.getCitationStyle(elements.citationStyle.value);
  const heading = ExportTools.getBibliographyHeading
    ? ExportTools.getBibliographyHeading(elements.citationStyle.value)
    : getBibliographyHeading(elements.citationStyle.value);

  if (!citationTexts.length) {
    UI.showMessage("No saved citations yet.", "warning");
    return;
  }

  ExportTools.downloadBlob(ExportTools.createDocxFile(citationTexts, {
    heading,
    hangingIndent: style.bibliography !== "numbered"
  }), "autocite-bibliography.docx");
  UI.showMessage("DOCX exported!", "success");
}

function exportPdf() {
  const exportHistory = getProjectFilteredHistory(State.exportProjectId);
  const citationTexts = ExportTools.getBibliographyEntries(exportHistory, elements.citationStyle.value);
  const citationSources = ExportTools.getBibliographySources
    ? ExportTools.getBibliographySources(exportHistory, elements.citationStyle.value)
    : [];
  const style = CitationGenerator.getCitationStyle(elements.citationStyle.value);
  const heading = ExportTools.getBibliographyHeading
    ? ExportTools.getBibliographyHeading(elements.citationStyle.value)
    : getBibliographyHeading(elements.citationStyle.value);

  if (!citationTexts.length) {
    UI.showMessage("No saved citations yet.", "warning");
    return;
  }

  ExportTools.downloadBlob(ExportTools.createPdfFile(citationTexts, {
    heading,
    hangingIndent: style.bibliography !== "numbered",
    sources: citationSources,
    styleValue: elements.citationStyle.value
  }), "autocite-bibliography.pdf");
  UI.showMessage("PDF exported!", "success");
}


function hideSidebarDocument() {
  document.documentElement.style.display = "none";
}

function closeSidebarWindow() {
  hideSidebarDocument();
  window.close();
}

function minimizeSidebar() {
  sidebarUnloadState = SIDEBAR_STATE_MINIMIZED;
  Storage.storageSet({ [SIDEBAR_STATE_KEY]: SIDEBAR_STATE_MINIMIZED }, closeSidebarWindow);
}

function closeSidebarFully() {
  sidebarUnloadState = SIDEBAR_STATE_DISMISSED;
  hideSidebarDocument();
  Storage.storageSet({ [SIDEBAR_STATE_KEY]: SIDEBAR_STATE_DISMISSED });

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: "CLOSE_AUTOCITE_SIDEBAR", dismissed: true, tabId: sidebarTabId }, () => {
      const ignoredError = chrome.runtime.lastError;
      closeSidebarWindow();
    });
    return;
  }

  closeSidebarWindow();
}

function markSidebarClosed() {
  Storage.storageSet({ [SIDEBAR_STATE_KEY]: sidebarUnloadState });

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({
      type: "AUTOCITE_SIDEBAR_STATE_CHANGED",
      sidebarState: sidebarUnloadState,
      tabId: sidebarTabId
    }, () => {
      const ignoredError = chrome.runtime.lastError;
    });
  }
}

function rememberSidebarTab() {
  if (Metadata && typeof Metadata.getTargetTabId === "function") {
    const targetTabId = Metadata.getTargetTabId();

    if (typeof targetTabId === "number") {
      sidebarTabId = targetTabId;
      return;
    }
  }

  if (typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.query) {
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
    if (activeTab && typeof activeTab.id === "number") {
      sidebarTabId = activeTab.id;
    }
  });
}

function listen(target, eventName, handler) {
  if (target && typeof target.addEventListener === "function") {
    target.addEventListener(eventName, handler);
  }
}

function setupEventListeners() {
  listen(elements.citationStyleButton, "click", toggleCitationStyleDropdown);
  listen(elements.citationStyleMenu, "keydown", (event) => {
    if (event.key === "Escape") {
      closeCitationStyleDropdown();
      elements.citationStyleButton.focus();
    }
  });
  listen(document, "click", (event) => {
    if (!elements.citationStyleDropdown.contains(event.target)) {
      closeCitationStyleDropdown();
    }

    if (elements.folderMenu && !elements.folderMenu.contains(event.target)) {
      elements.folderMenu.open = false;
    }

    if (elements.projectFilterMenu && !elements.projectFilterMenu.contains(event.target)) {
      elements.projectFilterMenu.open = false;
    }

    if (elements.exportProjectFilterMenu && !elements.exportProjectFilterMenu.contains(event.target)) {
      elements.exportProjectFilterMenu.open = false;
    }

    if (elements.exportMenu && !elements.exportMenu.contains(event.target)) {
      elements.exportMenu.open = false;
    }

    if (elements.moveFolderMenu && !elements.moveFolderMenu.contains(event.target)) {
      elements.moveFolderMenu.open = false;
    }
  });
  listen(buttons.clearCopiedText, "click", () => clearCitationForm());
  listen(elements.copiedText, "paste", handleCopiedTextPaste);
  listen(elements.copiedText, "change", handleCopiedTextChange);
  listen(elements.sourceUrl, "paste", handleSourceUrlPaste);
  listen(buttons.addContributor, "click", () => {
    Contributors.renderContributor(elements.contributorsList, Contributors.createEmptyContributor(), regenerateFromContributorEdit);
    generateCitation();
  });
  listen(buttons.citeSource, "click", scanCurrentSourceForCitation);
  listen(buttons.save, "click", saveCitation);
  listen(buttons.toggleSourceDetails, "click", toggleSourceDetails);
  listen(buttons.saveSourceDetails, "click", saveSourceDetails);
  listen(buttons.copyFull, "click", () => {
    const source = getSourceFromForm();
    const citationHtml = ExportTools.createHangingIndentHtml
      ? ExportTools.createHangingIndentHtml(elements.fullCitation.value, {
        source,
        styleValue: elements.citationStyle.value
      })
      : "";
    const citationRtf = ExportTools.createHangingIndentRtf
      ? ExportTools.createHangingIndentRtf(elements.fullCitation.value, {
        source,
        styleValue: elements.citationStyle.value
      })
      : "";
    CopyActions.copyText(elements.fullCitation.value, "full citation", UI.showMessage, { html: citationHtml, rtf: citationRtf });
  });
  listen(buttons.copyTextInText, "click", () => {
    const text = CopyActions.buildCopiedTextWithInTextCitation(elements.copiedText.value, elements.inTextCitation.value);
    CopyActions.copyText(text, "copied text with in-text citation", UI.showMessage);
  });
  listen(buttons.editSelected, "click", editSelectedCitations);
  listen(buttons.deleteSelected, "click", deleteSelectedCitations);
  listen(buttons.copySelected, "click", copySelectedCitations);
  listen(buttons.clearHistory, "click", clearCitationHistory);
  listen(buttons.newProject, "click", () => {
    if (elements.folderMenu) {
      elements.folderMenu.open = false;
    }
    createProject();
  });
  listen(buttons.renameProject, "click", () => {
    if (elements.folderMenu) {
      elements.folderMenu.open = false;
    }
    renameSelectedProject();
  });
  listen(buttons.deleteProject, "click", () => {
    if (elements.folderMenu) {
      elements.folderMenu.open = false;
    }
    deleteSelectedProject();
  });
  listen(buttons.copyBibliography, "click", copyBibliography);
  listen(buttons.exportTxt, "click", () => {
    if (elements.exportMenu) {
      elements.exportMenu.open = false;
    }
    exportTxt();
  });
  listen(buttons.exportPdf, "click", () => {
    if (elements.exportMenu) {
      elements.exportMenu.open = false;
    }
    exportPdf();
  });
  listen(buttons.exportDocx, "click", () => {
    if (elements.exportMenu) {
      elements.exportMenu.open = false;
    }
    exportDocx();
  });
  listen(buttons.minimizeSidebar, "click", minimizeSidebar);
  listen(buttons.closeSidebar, "click", closeSidebarFully);
  listen(buttons.useActiveTab, "click", useActiveTab);
  listen(elements.historySort, "change", () => renderHistory(State.currentHistory));
  listen(elements.historySortButton, "click", cycleHistorySort);
  listen(elements.historySearch, "input", () => renderHistory(State.currentHistory));
  listen(elements.projectFilter, "change", () => {
    State.selectedProjectId = getSafeProjectId(elements.projectFilter.value);
    State.selectedHistoryIndexes.clear();
    State.editingHistoryIndexes.clear();
    renderHistory(State.currentHistory);
  });
  listen(elements.exportProjectFilter, "change", () => {
    State.exportProjectId = getSafeProjectId(elements.exportProjectFilter.value);
    updateBibliographyPreview();
  });

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
    elements.accessDate
  ].filter(Boolean).forEach((field) => {
    listen(field, "input", generateCitation);
    listen(field, "change", generateCitation);
  });

  listen(elements.sourceUrl, "change", handleSourceUrlChange);

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
      Contributors.updateContributorListCollapse(elements.contributorsList);
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
      if (message.type === "AUTOCITE_CLOSE_SIDEBAR") {
        closeSidebarWindow();
        return;
      }

      if (message.type === "AUTOCITE_ACTIVE_TAB_CHANGED") {
        renderActiveTabStatus(message.activeTabContext);
        loadPageDetails({ preserveSavedSelection: false });
        return;
      }

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

      if (areaName === "local" && changes[CITATION_PROJECTS_KEY]) {
        State.projects = normalizeProjects(changes[CITATION_PROJECTS_KEY].newValue || []);
        renderProjectControls();
        renderHistory(State.currentHistory);
      }

      if (areaName === "local" && changes[SELECTED_CITATION_STYLE_KEY] && changes[SELECTED_CITATION_STYLE_KEY].newValue) {
        setCitationStyle(changes[SELECTED_CITATION_STYLE_KEY].newValue, { regenerate: true });
      }
    });
  }
}

function loadSavedCitationStyle() {
  Storage.storageGet([SELECTED_CITATION_STYLE_KEY], (result) => {
    setCitationStyle(result[SELECTED_CITATION_STYLE_KEY] || elements.citationStyle.value || "apa", { regenerate: true });
  });
}

function startAutoCite() {
  const requiredDomElements = [...Object.values(elements), ...Object.values(buttons)];

  if (requiredDomElements.some((element) => !element)) {
    return;
  }

  rememberSidebarTab();
  elements.accessDate.value = getTodayDate();
  renderCitationStyleDropdown();
  updateSourceTypeFields();
  setSourceDetailsExpanded(false);
  Contributors.setContributors(elements.contributorsList, [Contributors.createEmptyContributor()], regenerateFromContributorEdit);
  setupEventListeners();
  loadSavedCitationStyle();
  sidebarUnloadState = SIDEBAR_STATE_CLOSED;
  Storage.storageSet({ [SIDEBAR_STATE_KEY]: SIDEBAR_STATE_OPEN });
  loadPageDetails();
  reloadCitationHistory();
}

window.addEventListener("pagehide", markSidebarClosed);

startAutoCite();
})();
