// UI helpers: tabs, messages, and small DOM utilities.
(() => {

const TAB_LEAVE_MS = 180;
const VALID_TOAST_TYPES = ["info", "success", "error", "warning"];
const TOAST_TYPE_CLASSES = VALID_TOAST_TYPES.map((type) => `toast-message--${type}`);

function getValidClassTokens(classNames) {
  return classNames
    .flat()
    .filter((className) => typeof className === "string")
    .flatMap((className) => className.trim().split(/\s+/))
    .filter(Boolean);
}

function addClasses(element, ...classNames) {
  if (!element || !element.classList) {
    return;
  }

  const validClasses = getValidClassTokens(classNames);

  if (validClasses.length) {
    element.classList.add(...validClasses);
  }
}

function removeClasses(element, ...classNames) {
  if (!element || !element.classList) {
    return;
  }

  const validClasses = getValidClassTokens(classNames);

  if (validClasses.length) {
    element.classList.remove(...validClasses);
  }
}

function toggleClass(element, className, force) {
  const validClasses = getValidClassTokens([className]);

  if (!element || !element.classList || !validClasses.length) {
    return false;
  }

  return element.classList.toggle(validClasses[0], Boolean(force));
}

function getSafeToastType(type) {
  const normalizedType = typeof type === "string" ? type.trim().toLowerCase() : "";
  return VALID_TOAST_TYPES.includes(normalizedType) ? normalizedType : "info";
}

function showMessage(message, type = "info") {
  const toast = document.querySelector("#copyMessage");

  if (!toast) {
    return;
  }

  const safeType = getSafeToastType(type);
  const typeClass = `toast-message--${safeType}`;

  toast.textContent = String(message || "");
  removeClasses(toast, "is-visible", TOAST_TYPE_CLASSES);
  addClasses(toast, typeClass);

  requestAnimationFrame(() => {
    addClasses(toast, "is-visible");
  });

  window.clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => {
    removeClasses(toast, "is-visible");
  }, 1800);
}

function showTab(tabName) {
  const safeTabName = typeof tabName === "string" ? tabName.trim() : "";

  if (!safeTabName) {
    return;
  }

  const nextPanel = document.getElementById(`${safeTabName}Panel`);
  const currentPanel = document.querySelector(".tab-panel.is-active");

  document.querySelectorAll(".tab-button").forEach((button) => {
    toggleClass(button, "is-active", button.dataset.tab === safeTabName);
  });

  if (currentPanel && currentPanel !== nextPanel) {
    addClasses(currentPanel, "is-leaving");
    removeClasses(currentPanel, "is-active");

    window.setTimeout(() => {
      removeClasses(currentPanel, "is-leaving");
    }, TAB_LEAVE_MS);
  }

  if (nextPanel && nextPanel !== currentPanel) {
    addClasses(nextPanel, "is-active");
  }
}

function animateCitationFields(fields) {
  (Array.isArray(fields) ? fields : []).forEach((field) => {
    if (!field) {
      return;
    }

    removeClasses(field, "citation-updated");
    void field.offsetWidth;
    addClasses(field, "citation-updated");
  });
}

function createTextElement(tagName, text, className = "") {
  const safeTagName = typeof tagName === "string" && tagName.trim() ? tagName.trim() : "span";
  const element = document.createElement(safeTagName);
  element.textContent = String(text || "");

  addClasses(element, className);

  return element;
}

window.AutoCiteUI = {
  showMessage,
  showTab,
  animateCitationFields,
  createTextElement,
  addClasses,
  removeClasses,
  toggleClass
};
})();
