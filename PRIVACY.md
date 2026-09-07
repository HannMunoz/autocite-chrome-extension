# AutoCite Privacy Policy

Effective date: July 12, 2026

AutoCite helps users collect source details and create citations in a Chrome side panel.

## Data AutoCite Handles

AutoCite may process:

* Text you copy from a webpage after you activate AutoCite for that tab.
* Website links, DOI values, or source notes you paste into AutoCite fields.
* Source details from the active page, such as title, author metadata, publisher, publication date, and URL.
* Citations and bibliography entries you choose to save.

AutoCite does not passively read clipboard contents. Text is processed only when you copy selected text from a tab where AutoCite has been activated, or when you paste text directly into an AutoCite field. AutoCite does not collect copied text before you activate the extension for a tab. AutoCite does not run on `file://` pages.

## How Data Is Used

AutoCite uses this data only to generate citations, show citation history, and export bibliographies.

## Storage

Copied text, source details, and saved citations are stored locally in Chrome extension storage on your device. You can clear copied text or citation history from the extension interface.

## Sharing

AutoCite does not send copied text, saved citations, citation history, or bibliography content to a third-party analytics, advertising, or tracking service. AutoCite does not sell user data or share user data with third parties for advertising, marketing, creditworthiness, lending, or other non-core purposes.

AutoCite's use of information received from Chrome extension APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Network Access

AutoCite may make a limited metadata request to the current active page, an HTTPS source page, or an HTTPS PDF URL when needed to detect citation details from a URL you provide or from the active page you are citing. If a pasted HTTPS URL is outside the active tab, Chrome may ask you to grant AutoCite access to that specific website so the extension can scan citation metadata. AutoCite requests that access only for the site being scanned and attempts to release the optional site permission after the scan. These requests are used only for citation generation, omit cookies, do not send a referrer, and are limited in size and time.

When AutoCite detects a DOI or likely academic title, it may query Crossref to improve citation metadata. AutoCite sends only the DOI or title needed for that lookup. AutoCite does not send copied text, saved citations, citation history, or bibliography content to Crossref.

## Permissions

AutoCite requests:

* `sidePanel` to show the citation sidebar.
* `storage` to save citations locally.
* `activeTab` and `scripting` to read citation details only from the tab where you explicitly activate AutoCite.
* `clipboardWrite` to copy generated citations, in-text citations, or bibliography text when you request it.
* `https://api.crossref.org/*` to look up DOI or title metadata for academic sources.
* Optional website access to scan citation metadata from a specific pasted website URL when you grant access.

## Contact

For privacy questions, contact the extension publisher through the support information listed on the Chrome Web Store page.
