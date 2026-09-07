// Citation generator coordinator.
// This file chooses the correct formatter and provides shared formatting helpers.

(() => {
const Contributors = window.AutoCiteContributors;

function getYear(dateText) {
  const match = (dateText || "").match(/\d{4}/);
  return match ? match[0] : "";
}

function formatReadableDate(dateText) {
  if (!dateText) {
    return "";
  }

  const date = new Date(dateText);

  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function getApaDate(dateText) {
  if (!dateText) {
    return "n.d.";
  }

  const date = new Date(dateText);

  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).replace(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/, "$3, $1 $2");
}

function getShortTitle(title) {
  if (!title) {
    return "Untitled source";
  }

  return title.replace(/[."]/g, "").split(" ").filter(Boolean).slice(0, 4).join(" ");
}

function getFallbackName(source) {
  const organization = Contributors.getOrganizationContributor(source.contributors);
  return organization ? organization.organizationName : source.publisher || source.website || getShortTitle(source.title);
}

function getGeneralInTextContributor(source, style = "author-date") {
  const authors = Contributors.getAuthorContributors(source.contributors).filter((contributor) => contributor.lastName);

  if (authors.length > 2) {
    return `${authors[0].lastName} et al.`;
  }

  if (authors.length === 2) {
    return style === "mla" || style === "and" ? `${authors[0].lastName} and ${authors[1].lastName}` : `${authors[0].lastName} & ${authors[1].lastName}`;
  }

  return authors.length === 1 ? authors[0].lastName : getFallbackName(source);
}

function normalizeDoiOrUrl(value) {
  const cleanValue = (value || "").trim();

  if (/^10\.\d{4,9}\//i.test(cleanValue)) {
    return `https://doi.org/${cleanValue}`;
  }

  return cleanValue;
}

function formatApaContributorList(source) {
  const authors = Contributors.getAuthorContributors(source.contributors).filter((contributor) => contributor.lastName || contributor.organizationName);
  const organization = Contributors.getOrganizationContributor(source.contributors);

  if (authors.length) {
    const names = authors.map(Contributors.formatApaContributor);

    if (names.length > 5) {
      return `${names.slice(0, 5).join(", ")}, et al.`;
    }

    if (names.length === 1) {
      return names[0];
    }

    if (names.length === 2) {
      return `${names[0]}, & ${names[1]}`;
    }

    return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  }

  if (organization) {
    return organization.organizationName;
  }

  return getFallbackName(source);
}

function getApaInTextContributor(source) {
  const authors = Contributors.getAuthorContributors(source.contributors).filter((contributor) => contributor.lastName || contributor.organizationName);
  const organization = Contributors.getOrganizationContributor(source.contributors);

  if (authors.length === 1) {
    return authors[0].lastName || authors[0].organizationName;
  }

  if (authors.length === 2) {
    return `${authors[0].lastName} & ${authors[1].lastName}`;
  }

  if (authors.length > 2) {
    return `${authors[0].lastName} et al.`;
  }

  if (organization) {
    return organization.organizationName;
  }

  return getFallbackName(source);
}

function formatMlaContributorList(source) {
  const authors = Contributors.getAuthorContributors(source.contributors).filter((contributor) => contributor.lastName || contributor.organizationName);
  const organization = Contributors.getOrganizationContributor(source.contributors);

  if (authors.length) {
    const names = authors.map((contributor, index) => {
      return index === 0 ? Contributors.formatMlaContributor(contributor) : Contributors.formatFullName(contributor);
    });

    if (names.length > 5) {
      return `${names[0]}, et al`;
    }

    if (names.length === 1) {
      return names[0];
    }

    if (names.length === 2) {
      return `${names[0]}, and ${names[1]}`;
    }

    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
  }

  return organization ? organization.organizationName : "";
}

function formatChicagoContributorList(source) {
  const authors = Contributors.getAuthorContributors(source.contributors).filter((contributor) => contributor.lastName || contributor.organizationName);
  const organization = Contributors.getOrganizationContributor(source.contributors);

  if (authors.length) {
    const names = authors.map((contributor, index) => {
      return index === 0 ? Contributors.formatMlaContributor(contributor) : Contributors.formatFullName(contributor);
    });

    if (names.length > 5) {
      return `${names[0]}, et al.`;
    }

    if (names.length === 1) {
      return names[0];
    }

    if (names.length === 2) {
      return `${names[0]}, and ${names[1]}`;
    }

    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
  }

  return organization ? organization.organizationName : "";
}

function formatNumericContributorList(source) {
  const authors = Contributors.getAuthorContributors(source.contributors).filter((contributor) => contributor.lastName || contributor.organizationName);
  const organization = Contributors.getOrganizationContributor(source.contributors);

  if (authors.length) {
    const names = authors.map((contributor) => {
      if (contributor.organizationName) {
        return contributor.organizationName;
      }

      const initials = [contributor.firstName, contributor.middleName]
        .filter(Boolean)
        .join(" ")
        .split(/\s+/)
        .filter(Boolean)
        .map((namePart) => namePart.charAt(0).toUpperCase())
        .join("");

      return `${contributor.lastName}${initials ? ` ${initials}` : ""}`;
    });

    if (names.length > 6) {
      return `${names.slice(0, 6).join(", ")} et al`;
    }

    return names.join(", ");
  }

  return organization ? organization.organizationName : "";
}

const citationStyles = [
  { value: "apa", label: "APA 7th Edition", bibliography: "alphabetical" },
  { value: "mla", label: "MLA 9th Edition", bibliography: "alphabetical" },
  { value: "chicago", label: "Chicago Author-Date", bibliography: "alphabetical" },
  { value: "chicago-notes", label: "Chicago Notes-Bibliography", bibliography: "alphabetical", inText: "numbered" },
  { value: "harvard", label: "Harvard Referencing", bibliography: "alphabetical" },
  { value: "ieee", label: "IEEE", bibliography: "numbered", referenceMarker: "bracket" },
  { value: "vancouver", label: "Vancouver", bibliography: "numbered", referenceMarker: "period" },
  { value: "ama", label: "AMA", bibliography: "numbered", referenceMarker: "period" },
  { value: "turabian", label: "Turabian", bibliography: "alphabetical" }
];

function getCitationStyles() {
  return citationStyles.slice();
}

function getCitationStyle(styleValue) {
  return citationStyles.find((style) => style.value === styleValue) || citationStyles[0];
}

function getCitationStyleLabel(styleValue) {
  return getCitationStyle(styleValue).label;
}

function getCitationStyleValue(styleLabel) {
  const normalizedLabel = String(styleLabel || "").toLowerCase();
  const style = citationStyles.find((citationStyle) => {
    return citationStyle.label.toLowerCase() === normalizedLabel || citationStyle.value === styleLabel;
  });

  if (style) {
    return style.value;
  }

  if (normalizedLabel.includes("chicago") && normalizedLabel.includes("notes")) {
    return "chicago-notes";
  }

  if (normalizedLabel.includes("chicago")) {
    return "chicago";
  }

  return "apa";
}

const formatterHelpers = {
  formatReadableDate,
  getApaDate,
  getYear,
  getShortTitle,
  getFallbackName,
  getGeneralInTextContributor,
  normalizeDoiOrUrl,
  formatApaContributorList,
  getApaInTextContributor,
  formatMlaContributorList,
  formatChicagoContributorList,
  formatNumericContributorList,
  getPrimaryAuthor: Contributors.getPrimaryAuthor,
  getOrganizationContributor: Contributors.getOrganizationContributor
};

const citationTemplates = {
  apa: {
    website: window.AutoCiteAPA.generateAPA,
    pdf: window.AutoCiteAPA.generateAPAPDF,
    book: window.AutoCiteAPA.generateAPABook,
    journal: window.AutoCiteAPA.generateAPAJournal
  },
  mla: {
    website: window.AutoCiteMLA.generateMLA,
    pdf: window.AutoCiteMLA.generateMLAPDF,
    book: window.AutoCiteMLA.generateMLABook,
    journal: window.AutoCiteMLA.generateMLAJournal
  },
  chicago: {
    website: window.AutoCiteChicago.generateChicago,
    pdf: window.AutoCiteChicago.generateChicagoPDF,
    book: window.AutoCiteChicago.generateChicagoBook,
    journal: window.AutoCiteChicago.generateChicagoJournal
  },
  "chicago-notes": {
    website: window.AutoCiteAdditionalFormatters.generateChicagoNotes,
    pdf: window.AutoCiteAdditionalFormatters.generateChicagoNotes,
    book: window.AutoCiteAdditionalFormatters.generateChicagoNotes,
    journal: window.AutoCiteAdditionalFormatters.generateChicagoNotes
  },
  harvard: {
    website: window.AutoCiteAdditionalFormatters.generateHarvard,
    pdf: window.AutoCiteAdditionalFormatters.generateHarvard,
    book: window.AutoCiteAdditionalFormatters.generateHarvard,
    journal: window.AutoCiteAdditionalFormatters.generateHarvard
  },
  ieee: {
    website: window.AutoCiteAdditionalFormatters.generateIEEE,
    pdf: window.AutoCiteAdditionalFormatters.generateIEEE,
    book: window.AutoCiteAdditionalFormatters.generateIEEE,
    journal: window.AutoCiteAdditionalFormatters.generateIEEE
  },
  vancouver: {
    website: window.AutoCiteAdditionalFormatters.generateVancouver,
    pdf: window.AutoCiteAdditionalFormatters.generateVancouver,
    book: window.AutoCiteAdditionalFormatters.generateVancouver,
    journal: window.AutoCiteAdditionalFormatters.generateVancouver
  },
  ama: {
    website: window.AutoCiteAdditionalFormatters.generateAMA,
    pdf: window.AutoCiteAdditionalFormatters.generateAMA,
    book: window.AutoCiteAdditionalFormatters.generateAMA,
    journal: window.AutoCiteAdditionalFormatters.generateAMA
  },
  turabian: {
    website: window.AutoCiteAdditionalFormatters.generateTurabian,
    pdf: window.AutoCiteAdditionalFormatters.generateTurabian,
    book: window.AutoCiteAdditionalFormatters.generateTurabian,
    journal: window.AutoCiteAdditionalFormatters.generateTurabian
  }
};

function generateCitationForSource(style, source) {
  const styleTemplates = citationTemplates[style] || {};
  const formatter = styleTemplates[source.sourceType] || styleTemplates.website || window.AutoCiteAPA.generateAPA;
  return formatter(source, formatterHelpers);
}

window.AutoCiteCitationGenerator = {
  generateCitationForSource,
  getCitationStyles,
  getCitationStyle,
  getCitationStyleLabel,
  getCitationStyleValue,
  getShortTitle,
  getYear
};
})();
