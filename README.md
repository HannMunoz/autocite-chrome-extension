# AutoCite Chromium Extension

AutoCite is a Chromium browser extension that helps students create citations from copied source text. It opens in the browser side panel when available, and falls back to an AutoCite popup window in Chromium-based browsers.

## Features

* Detects copied text after you open AutoCite on a tab
* Lets users paste website links when copied webpage text cannot be detected
* Detects DOI values from copied text, page metadata, scanned webpages, and PDF URLs
* Generates citations for APA 7th Edition, MLA 9th Edition, Chicago, Harvard, IEEE, Vancouver, AMA, and Turabian styles
* Supports websites, PDFs, books, and journal articles
* Generates full citation and in-text citation
* Lets users copy text with an in-text citation
* Saves citation history locally
* Organizes saved citations by project, class, essay, topic, or assignment
* Allows editing and deleting saved citations
* Exports style-aware bibliographies with headings such as References, Works Cited, or Bibliography
* Creates cleaner DOCX bibliography exports for Google Docs and Microsoft Word
* Reads citation metadata, DOI values, and academic lookup results from website and PDF URLs
* Uses local browser storage for privacy
* Supports Google Chrome, Microsoft Edge, Brave, Opera, and other modern Chromium-based browsers

## Privacy

AutoCite stores copied text, citations, and citation history locally in the user's browser. AutoCite may make limited metadata requests to the active/source page and may query Crossref with a DOI or title for academic citation lookup. See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## How to Install and Test

1. Download or clone this repository.
2. Make sure the folder contains `manifest.json`.
3. Open a Chromium-based browser.
4. Open that browser's extensions page:
   * Chrome: `chrome://extensions/`
   * Microsoft Edge: `edge://extensions/`
   * Brave: `brave://extensions/`
   * Opera: `opera://extensions/`
5. Turn on **Developer mode** at the top right.
6. Click **Load unpacked**.
7. Select the main **AutoCite extension folder**.
8. The extension should now appear in the browser.
9. Pin the extension by clicking the puzzle icon beside the address bar.
10. Open any website, click AutoCite, then copy text to test the sidebar and citation features.

## Chromium Compatibility Checklist

Run this checklist in Chrome, Edge, Brave, Opera, and any other target Chromium browser before packaging a release:

* Extension loads without manifest warnings.
* Toolbar icon opens AutoCite.
* Native side panel opens when the browser supports `chrome.sidePanel`.
* AutoCite popup fallback opens when the browser does not expose the Side Panel API.
* Connect button reads the current web tab, not the extension page.
* Restricted browser pages such as `chrome://`, `edge://`, `brave://`, and `opera://` show the manual-entry message.
* Highlighting and copying webpage text updates the Copied Text field.
* Pasted website links scan citation metadata when site access is granted.
* Copy Full Citation, Copy Text + In-text Citation, Copy Bibliography, TXT export, and DOCX export all work.
* Project creation, renaming, deletion, filtering, and project-specific export work.
* Bibliography headings update when switching citation styles.
* History edits preserve manual citation text until Regenerate Citation is clicked.
* Citation history persists after closing and reopening the browser.

## Important Note

Do not upload the ZIP file directly to a browser's extensions page. Extract the ZIP first, then select the folder that contains `manifest.json`.

## Project Status

This project is prepared for Chromium extension testing and Chrome Web Store review.

## Copyright

Copyright (c) 2026 NovaTivez. All rights reserved.

This project is shared for viewing, testing, and educational demonstration only. You may not copy, modify, redistribute, or use this code in another project without permission.
