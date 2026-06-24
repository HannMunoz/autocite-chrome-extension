// Copy helpers.
(() => {

async function copyText(text, label, showMessage) {
  const safeText = typeof text === "string" ? text : "";
  const safeLabel = typeof label === "string" && label.trim() ? label.trim() : "content";
  const notify = typeof showMessage === "function" ? showMessage : () => {};

  if (!safeText.trim()) {
    notify(`No ${safeLabel} yet.`, "warning");
    return;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(safeText);
    } else {
      copyTextWithFallback(safeText);
    }
  } catch (error) {
    copyTextWithFallback(safeText);
  }

  notify("Copied!", "success");
}

async function readClipboardText(showMessage) {
  const notify = typeof showMessage === "function" ? showMessage : () => {};

  if (!navigator.clipboard || !navigator.clipboard.readText) {
    notify("Clipboard paste is not available in this browser.", "warning");
    return "";
  }

  try {
    const clipboardText = await navigator.clipboard.readText();

    if (!clipboardText.trim()) {
      notify("Clipboard is empty.", "warning");
      return "";
    }

    return clipboardText;
  } catch (error) {
    notify("Clipboard access was blocked. Paste with Ctrl+V instead.", "warning");
    return "";
  }
}

function copyTextWithFallback(text) {
  const temporaryTextBox = document.createElement("textarea");
  temporaryTextBox.value = text;
  document.body.appendChild(temporaryTextBox);
  temporaryTextBox.select();
  document.execCommand("copy");
  temporaryTextBox.remove();
}

function buildCopiedTextWithInTextCitation(copiedText, inTextCitation) {
  const text = typeof copiedText === "string" ? copiedText.trim() : "";
  const citation = typeof inTextCitation === "string" ? inTextCitation.trim() : "";

  if (!text || !citation) {
    return "";
  }

  const finalCharacter = text.slice(-1);
  const punctuation = [".", "!", "?", ";", ":"];

  if (punctuation.includes(finalCharacter)) {
    return `${text.slice(0, -1).trim()} ${citation}${finalCharacter}`;
  }

  return `${text} ${citation}`;
}

window.AutoCiteCopyActions = {
  copyText,
  readClipboardText,
  buildCopiedTextWithInTextCitation
};
})();
