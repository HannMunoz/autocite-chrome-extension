// Copy helpers.
(() => {

async function copyText(text, label, showMessage, options = {}) {
  const safeText = typeof text === "string" ? text : "";
  const safeLabel = typeof label === "string" && label.trim() ? label.trim() : "content";
  const notify = typeof showMessage === "function" ? showMessage : () => {};
  const html = typeof options.html === "string" ? options.html : "";
  const rtf = typeof options.rtf === "string" ? options.rtf : "";

  if (!safeText.trim()) {
    notify(`No ${safeLabel} yet.`, "warning");
    return;
  }

  try {
    if (html && navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== "undefined") {
      const clipboardData = {
        "text/plain": new Blob([safeText], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" })
      };

      if (rtf && ClipboardItem.supports && ClipboardItem.supports("text/rtf")) {
        clipboardData["text/rtf"] = new Blob([rtf], { type: "text/rtf" });
      }

      await navigator.clipboard.write([new ClipboardItem(clipboardData)]);
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(safeText);
    } else {
      copyTextWithFallback(safeText);
    }
  } catch (error) {
    copyTextWithFallback(safeText);
  }

  notify("Copied!", "success");
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
  buildCopiedTextWithInTextCitation
};
})();
