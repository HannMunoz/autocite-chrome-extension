// Contributor helpers and UI.
// Contributors include authors, editors, translators, and organizations.
(() => {

function createEmptyContributor(role = "Author") {
  return {
    role,
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    organizationName: ""
  };
}

function cleanDetectedContributorName(name) {
  return (name || "")
    .replace(/\b(written by|posted by|author:|authors:|by|published by|reviewed by)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^\W+|\W+$/g, "")
    .trim();
}

function getDetectedSuffix(parts) {
  if (!parts.length) {
    return "";
  }

  const suffixes = ["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v", "vi"];
  const lastPart = parts[parts.length - 1].replace(/,/g, "").toLowerCase();
  return suffixes.includes(lastPart) ? parts.pop().replace(/,$/, "") : "";
}

function splitFullName(fullName) {
  const cleanedName = cleanDetectedContributorName(fullName);

  if (!cleanedName) {
    return createEmptyContributor();
  }

  // Some citation metadata uses "Last, First Middle" instead of "First Middle Last".
  if (cleanedName.includes(",")) {
    const commaParts = cleanedName.split(",").map((part) => part.trim()).filter(Boolean);

    if (commaParts.length >= 2) {
      const lastName = commaParts[0];
      const nameParts = commaParts.slice(1).join(" ").split(" ").filter(Boolean);
      const suffix = getDetectedSuffix(nameParts);

      return {
        ...createEmptyContributor(),
        firstName: nameParts[0] || "",
        middleName: nameParts.slice(1).join(" "),
        lastName,
        suffix
      };
    }
  }

  const parts = cleanedName.split(" ").filter(Boolean);
  const suffix = getDetectedSuffix(parts);

  if (!parts.length) {
    return createEmptyContributor();
  }

  if (parts.length === 1) {
    return { ...createEmptyContributor(), lastName: parts[0] };
  }

  return {
    ...createEmptyContributor(),
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
    suffix
  };
}

function splitDetectedAuthors(authorText) {
  const cleanedAuthorText = cleanDetectedContributorName(authorText);

  if (!cleanedAuthorText) {
    return [createEmptyContributor()];
  }

  const seen = new Set();

  return cleanedAuthorText
    .split(/\s*;\s*|\s*\|\s*|\s+and\s+|\s+&\s+/i)
    .map(cleanDetectedContributorName)
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .map(splitFullName);
}

function getContributorsFromForm(contributorsList) {
  if (!contributorsList) {
    return [];
  }

  return Array.from(contributorsList.querySelectorAll(".contributor-card")).map((card) => ({
    role: card.querySelector(".contributor-role")?.value || "Author",
    firstName: card.querySelector(".contributor-first")?.value.trim() || "",
    middleName: card.querySelector(".contributor-middle")?.value.trim() || "",
    lastName: card.querySelector(".contributor-last")?.value.trim() || "",
    suffix: card.querySelector(".contributor-suffix")?.value.trim() || "",
    organizationName: card.querySelector(".contributor-organization")?.value.trim() || ""
  }));
}

function getAuthorContributors(contributors) {
  return contributors.filter((contributor) => contributor.role === "Author");
}

function getOrganizationContributor(contributors) {
  return contributors.find((contributor) => contributor.role === "Organization" && contributor.organizationName);
}

function getInitials(firstName, middleName) {
  return [firstName, middleName]
    .join(" ")
    .split(" ")
    .filter(Boolean)
    .map((name) => `${name.charAt(0).toUpperCase()}.`)
    .join(" ");
}

function formatApaContributor(contributor) {
  if (contributor.role === "Organization") {
    return contributor.organizationName;
  }

  const initials = getInitials(contributor.firstName, contributor.middleName);
  const suffix = contributor.suffix ? `, ${contributor.suffix}` : "";
  return `${contributor.lastName}${suffix}${initials ? `, ${initials}` : ""}`.trim();
}

function formatFullName(contributor) {
  if (!contributor) {
    return "";
  }

  if (contributor.role === "Organization") {
    return contributor.organizationName;
  }

  return [contributor.firstName, contributor.middleName, contributor.lastName, contributor.suffix]
    .filter(Boolean)
    .join(" ");
}

function formatMlaContributor(contributor) {
  if (!contributor) {
    return "";
  }

  if (contributor.role === "Organization") {
    return contributor.organizationName;
  }

  const firstMiddle = [contributor.firstName, contributor.middleName].filter(Boolean).join(" ");
  const suffix = contributor.suffix ? `, ${contributor.suffix}` : "";

  if (!contributor.lastName) {
    return firstMiddle || "";
  }

  return `${contributor.lastName}, ${firstMiddle}${suffix}`.trim().replace(/,\s*$/, "");
}

function getPrimaryAuthor(contributors) {
  return getAuthorContributors(contributors).find((contributor) => contributor.lastName || contributor.organizationName);
}

function updateContributorCardFields(card) {
  if (!card) {
    return;
  }

  const roleField = card.querySelector(".contributor-role");

  if (!roleField) {
    return;
  }

  const isOrganization = roleField.value === "Organization";
  const personFields = card.querySelector(".person-fields");
  const organizationField = card.querySelector(".organization-field");

  if (personFields) {
    personFields.classList.toggle("is-hidden", isOrganization);
  }

  if (organizationField) {
    organizationField.classList.toggle("is-hidden", !isOrganization);
  }

  updateContributorFieldStatus(card, ".contributor-first", !isOrganization, "First name");
  updateContributorFieldStatus(card, ".contributor-last", !isOrganization, "Last name");
  updateContributorFieldStatus(card, ".contributor-organization", isOrganization, "Organization name");
}

function updateContributorFieldStatus(card, inputSelector, isRequired, labelText) {
  const input = card.querySelector(inputSelector);

  if (!input) {
    return;
  }

  let status = input.parentElement.querySelector(".field-status");

  if (!isRequired) {
    if (status) {
      status.remove();
    }

    return;
  }

  if (!status) {
    status = document.createElement("p");
    status.className = "field-status";
    input.parentElement.appendChild(status);
  }

  const isComplete = Boolean(input.value.trim());
  status.className = `field-status ${isComplete ? "is-complete" : "is-missing"}`;
  status.textContent = isComplete ? `${labelText} added.` : `Missing ${labelText.toLowerCase()}.`;
}

function createLabeledInput(labelText, className, placeholder = "") {
  const label = document.createElement("label");
  const input = document.createElement("input");
  label.append(document.createTextNode(labelText), input);
  input.className = className;
  input.type = "text";
  input.placeholder = placeholder;
  return label;
}

function updateContributorListCollapse(contributorsList) {
  if (!contributorsList) {
    return;
  }

  const cards = Array.from(contributorsList.querySelectorAll(".contributor-card"));
  const authorCards = cards.filter((card) => card.querySelector(".contributor-role")?.value === "Author");
  let toggleButton = contributorsList.querySelector(".contributors-toggle");

  cards.forEach((card) => {
    card.classList.remove("is-collapsed-author");
    card.removeAttribute("aria-hidden");
  });

  if (authorCards.length <= 1) {
    if (toggleButton) {
      toggleButton.remove();
    }

    contributorsList.dataset.authorsExpanded = "false";
    return;
  }

  if (!toggleButton) {
    toggleButton = document.createElement("button");
    toggleButton.className = "contributors-toggle";
    toggleButton.type = "button";
    toggleButton.addEventListener("click", () => {
      contributorsList.dataset.authorsExpanded = contributorsList.dataset.authorsExpanded === "true" ? "false" : "true";
      updateContributorListCollapse(contributorsList);
    });
  }

  const expanded = contributorsList.dataset.authorsExpanded === "true";
  const hiddenCount = authorCards.length - 1;

  toggleButton.classList.toggle("is-expanded", expanded);
  toggleButton.setAttribute("aria-expanded", String(expanded));
  toggleButton.textContent = `${expanded ? "Hide" : "Show"} ${hiddenCount} more author${hiddenCount === 1 ? "" : "s"}`;

  contributorsList.insertBefore(toggleButton, authorCards[1]);

  authorCards.slice(1).forEach((card) => {
    card.classList.toggle("is-collapsed-author", !expanded);
    card.setAttribute("aria-hidden", String(!expanded));
  });
}

function renderContributor(contributorsList, contributor = createEmptyContributor(), onChange = () => {}) {
  if (!contributorsList) {
    return;
  }

  const card = document.createElement("div");
  card.className = "contributor-card";
  const topRow = document.createElement("div");
  const roleLabel = document.createElement("label");
  const roleSelect = document.createElement("select");
  const removeButton = document.createElement("button");
  const personFields = document.createElement("div");
  const organizationField = document.createElement("div");

  topRow.className = "contributor-top-row";
  roleLabel.className = "role-field";
  roleSelect.className = "contributor-role";
  ["Author", "Editor", "Translator", "Organization"].forEach((role) => {
    const option = document.createElement("option");
    option.textContent = role;
    roleSelect.appendChild(option);
  });
  roleLabel.append(document.createTextNode("Role"), roleSelect);

  removeButton.className = "trash-button remove-contributor";
  removeButton.type = "button";
  removeButton.title = "Remove contributor";
  removeButton.setAttribute("aria-label", "Remove contributor");
  removeButton.textContent = "Remove";
  topRow.append(roleLabel, removeButton);

  personFields.className = "person-fields";
  personFields.append(
    createLabeledInput("First Name", "contributor-first"),
    createLabeledInput("Middle Name", "contributor-middle"),
    createLabeledInput("Last Name", "contributor-last"),
    createLabeledInput("Suffix", "contributor-suffix", "Jr., III")
  );

  organizationField.className = "organization-field";
  organizationField.appendChild(createLabeledInput("Organization Name", "contributor-organization"));
  card.append(topRow, personFields, organizationField);

  card.querySelector(".contributor-role").value = contributor.role || "Author";
  card.querySelector(".contributor-first").value = contributor.firstName || "";
  card.querySelector(".contributor-middle").value = contributor.middleName || "";
  card.querySelector(".contributor-last").value = contributor.lastName || "";
  card.querySelector(".contributor-suffix").value = contributor.suffix || "";
  card.querySelector(".contributor-organization").value = contributor.organizationName || "";

  card.querySelector(".remove-contributor").addEventListener("click", () => {
    card.remove();

    if (!contributorsList.children.length) {
      renderContributor(contributorsList, createEmptyContributor(), onChange);
    }

    onChange();
    updateContributorListCollapse(contributorsList);
  });

  contributorsList.appendChild(card);
  updateContributorCardFields(card);
  updateContributorListCollapse(contributorsList);
}

function setContributors(contributorsList, contributors, onChange = () => {}) {
  if (!contributorsList) {
    return;
  }

  contributorsList.replaceChildren();
  contributorsList.dataset.authorsExpanded = "false";
  const contributorList = Array.isArray(contributors) && contributors.length ? contributors : [createEmptyContributor()];
  contributorList.forEach((contributor) => renderContributor(contributorsList, contributor, onChange));
  updateContributorListCollapse(contributorsList);
}

window.AutoCiteContributors = {
  createEmptyContributor,
  splitDetectedAuthors,
  getContributorsFromForm,
  getAuthorContributors,
  getOrganizationContributor,
  getPrimaryAuthor,
  formatApaContributor,
  formatFullName,
  formatMlaContributor,
  renderContributor,
  setContributors,
  updateContributorListCollapse,
  updateContributorCardFields
};
})();
