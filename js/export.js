// Bibliography sorting and export helpers.

(() => {
const ExportContributors = window.AutoCiteContributors;
const ExportCitationGenerator = window.AutoCiteCitationGenerator;

function getBibliographySortKey(savedCitation) {
  if (typeof savedCitation === "string") {
    return savedCitation.toLowerCase();
  }

  const contributors = savedCitation.contributors || [];
  const primaryAuthor = ExportContributors.getPrimaryAuthor(contributors);
  const organization = ExportContributors.getOrganizationContributor(contributors);
  const authorLastName = primaryAuthor ? primaryAuthor.lastName || primaryAuthor.organizationName : "";
  const organizationName = organization ? organization.organizationName : savedCitation.organization || "";
  const savedAuthor = savedCitation.author || "";
  const title = savedCitation.sourceTitle || "";
  const fullCitation = savedCitation.fullCitation || "";

  return (authorLastName || savedAuthor || organizationName || title || fullCitation).toLowerCase();
}

function getSortedBibliographyCitations(history) {
  return history
    .filter((savedCitation) => typeof savedCitation === "string" || savedCitation.fullCitation)
    .slice()
    .sort((firstCitation, secondCitation) => {
      return getBibliographySortKey(firstCitation).localeCompare(getBibliographySortKey(secondCitation));
    });
}

function getFormattedBibliographyCitation(savedCitation, styleValue) {
  if (typeof savedCitation === "string") {
    return savedCitation;
  }

  return savedCitation.fullCitation;
}

function getBibliographyEntries(history, styleValue) {
  const style = ExportCitationGenerator && ExportCitationGenerator.getCitationStyle
    ? ExportCitationGenerator.getCitationStyle(styleValue)
    : { bibliography: "alphabetical" };
  const bibliographyMode = style.bibliography || "alphabetical";
  const citationList = bibliographyMode === "numbered"
    ? history.filter((savedCitation) => typeof savedCitation === "string" || savedCitation.fullCitation).slice().reverse()
    : getSortedBibliographyCitations(history);

  return citationList.map((savedCitation, index) => {
    const text = getFormattedBibliographyCitation(savedCitation, styleValue);

    if (bibliographyMode === "numbered") {
      const cleanText = text.replace(/^\[\d+\]\s*/, "").replace(/^\d+\.\s*/, "").replace(/^#\.\s*/, "");
      return style.referenceMarker === "bracket" ? `[${index + 1}] ${cleanText}` : `${index + 1}. ${cleanText}`;
    }

    return text;
  });
}

function getBibliographySources(history, styleValue) {
  const style = ExportCitationGenerator && ExportCitationGenerator.getCitationStyle
    ? ExportCitationGenerator.getCitationStyle(styleValue)
    : { bibliography: "alphabetical" };
  const bibliographyMode = style.bibliography || "alphabetical";
  const citationList = bibliographyMode === "numbered"
    ? history.filter((savedCitation) => typeof savedCitation !== "string" && savedCitation.fullCitation).slice().reverse()
    : getSortedBibliographyCitations(history).filter((savedCitation) => typeof savedCitation !== "string");

  return citationList;
}

function getBibliographyHeading(styleValue) {
  const style = ExportCitationGenerator && ExportCitationGenerator.getCitationStyleValue
    ? ExportCitationGenerator.getCitationStyleValue(styleValue)
    : styleValue;

  if (style === "mla") {
    return "Works Cited";
  }

  if (style === "chicago" || style === "chicago-notes" || style === "turabian") {
    return "Bibliography";
  }

  return "References";
}

function getBibliographyText(history, styleValue, options = {}) {
  const entries = getBibliographyEntries(history, styleValue);
  const body = entries.join("\n\n");

  if (options.includeHeading === false) {
    return body;
  }

  const heading = options.heading || getBibliographyHeading(styleValue);
  return body ? `${heading}\n\n${body}` : "";
}

function escapeHtml(text) {
  return String(text || "").replace(/[<>&"']/g, (character) => {
    const replacements = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "\"": "&quot;",
      "'": "&#39;"
    };

    return replacements[character];
  });
}

function escapeRtf(text) {
  return String(text || "")
    .replace(/[\\{}]/g, "\\$&")
    .replace(/\n/g, "\\line ");
}

function getCitationTitle(source) {
  return source && (source.title || source.sourceTitle) ? source.title || source.sourceTitle : "";
}

function getItalicTargets(source = {}, styleValue = "") {
  const style = String(styleValue || "").toLowerCase();
  const sourceType = source.sourceType || "website";
  const title = getCitationTitle(source);
  const targets = [];

  if (sourceType === "journal") {
    targets.push(source.journalName);
  } else if (sourceType === "book" || sourceType === "pdf") {
    targets.push(title);
  } else if (style === "apa" || style === "harvard") {
    targets.push(title);
  } else if (style === "mla" || style.includes("chicago") || style === "turabian") {
    targets.push(source.website || source.publisher);
  }

  return targets
    .filter((target) => typeof target === "string" && target.trim().length > 2)
    .map((target) => target.trim())
    .sort((first, second) => second.length - first.length);
}

function getFormattedSegments(text, italicTargets = []) {
  const value = String(text || "");
  const ranges = [];

  italicTargets.forEach((target) => {
    let startIndex = value.indexOf(target);

    while (startIndex >= 0) {
      const endIndex = startIndex + target.length;
      const overlaps = ranges.some((range) => startIndex < range.end && endIndex > range.start);

      if (!overlaps) {
        ranges.push({ start: startIndex, end: endIndex });
      }

      startIndex = value.indexOf(target, endIndex);
    }
  });

  ranges.sort((first, second) => first.start - second.start);

  if (!ranges.length) {
    return [{ text: value, italic: false }];
  }

  const segments = [];
  let cursor = 0;

  ranges.forEach((range) => {
    if (range.start > cursor) {
      segments.push({ text: value.slice(cursor, range.start), italic: false });
    }

    segments.push({ text: value.slice(range.start, range.end), italic: true });
    cursor = range.end;
  });

  if (cursor < value.length) {
    segments.push({ text: value.slice(cursor), italic: false });
  }

  return segments;
}

function getFormattedCitationHtml(citation, options = {}) {
  const italicTargets = getItalicTargets(options.source, options.styleValue);

  return getFormattedSegments(citation, italicTargets).map((segment) => {
    const html = escapeHtml(segment.text).replace(/\n/g, "<br>");
    return segment.italic ? `<i>${html}</i>` : html;
  }).join("");
}

function createHangingIndentHtml(citations, options = {}) {
  const citationList = Array.isArray(citations) ? citations : [citations];
  const sources = Array.isArray(options.sources) ? options.sources : [];
  const heading = options.heading ? `<p style="margin:0 0 12pt 0;font-weight:700;line-height:200%;font-family:'Times New Roman', Times, serif;font-size:12pt;">${escapeHtml(options.heading)}</p>` : "";
  const body = citationList
    .filter((citation) => typeof citation === "string" && citation.trim())
    .map((citation, index) => {
      const source = sources[index] || options.source || {};
      const formattedCitation = getFormattedCitationHtml(citation, {
        source,
        styleValue: options.styleValue
      });
      return `<p class="csl-entry" style="margin:0;padding-left:36pt;text-indent:-36pt;line-height:200%;font-family:'Times New Roman', Times, serif;font-size:12pt;mso-line-height-alt:200%;">${formattedCitation}</p>`;
    })
    .join("");

  return `<div style="font-family:'Times New Roman', Times, serif;font-size:12pt;color:#000;">${heading}${body}</div>`;
}

function getFormattedCitationRtf(citation, options = {}) {
  const italicTargets = getItalicTargets(options.source, options.styleValue);

  return getFormattedSegments(citation, italicTargets).map((segment) => {
    const rtfText = escapeRtf(segment.text);
    return segment.italic ? `\\i ${rtfText}\\i0 ` : rtfText;
  }).join("");
}

function createHangingIndentRtf(citations, options = {}) {
  const citationList = Array.isArray(citations) ? citations : [citations];
  const sources = Array.isArray(options.sources) ? options.sources : [];
  const heading = options.heading ? `\\pard\\plain\\f0\\fs24\\sl480\\slmult1\\b ${escapeRtf(options.heading)}\\b0\\par ` : "";
  const body = citationList
    .filter((citation) => typeof citation === "string" && citation.trim())
    .map((citation, index) => {
      return `\\pard\\fi-720\\li720\\sl480\\slmult1 ${getFormattedCitationRtf(citation, {
        source: sources[index] || options.source || {},
        styleValue: options.styleValue
      })}\\par `;
    })
    .join("");

  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\f0\\fs24 ${heading}${body}}`;
}

function getBibliographyHtml(history, styleValue, options = {}) {
  const entries = getBibliographyEntries(history, styleValue);
  const sources = getBibliographySources(history, styleValue);
  const heading = options.includeHeading === false ? "" : options.heading || getBibliographyHeading(styleValue);
  return createHangingIndentHtml(entries, { heading, sources, styleValue });
}

function getBibliographyRtf(history, styleValue, options = {}) {
  const entries = getBibliographyEntries(history, styleValue);
  const sources = getBibliographySources(history, styleValue);
  const heading = options.includeHeading === false ? "" : options.heading || getBibliographyHeading(styleValue);
  return createHangingIndentRtf(entries, { heading, sources, styleValue });
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  const safeFilename = String(filename || "autocite-export.txt")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120) || "autocite-export.txt";
  link.href = URL.createObjectURL(blob);
  link.download = safeFilename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeXml(text) {
  return text.replace(/[<>&"']/g, (character) => {
    const replacements = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "\"": "&quot;",
      "'": "&apos;"
    };

    return replacements[character];
  });
}

function createParagraph(text, options = {}) {
  const spacing = options.spacing || {};
  const indent = options.indent || {};
  const style = options.style ? `<w:pStyle w:val="${options.style}"/>` : "";
  const spacingXml = `<w:spacing w:before="${spacing.before || 0}" w:after="${spacing.after || 0}" w:line="${spacing.line || 480}" w:lineRule="auto"/>`;
  const indentXml = indent.hanging ? `<w:ind w:left="${indent.left || 720}" w:hanging="${indent.hanging}"/>` : "";
  const boldStart = options.bold ? "<w:b/>" : "";
  const fontXml = `<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>`;
  const sizeXml = `<w:sz w:val="24"/><w:szCs w:val="24"/>`;

  return `<w:p><w:pPr>${style}${spacingXml}${indentXml}</w:pPr><w:r><w:rPr>${fontXml}${sizeXml}${boldStart}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function createDocumentXml(citations, options = {}) {
  const heading = options.heading || "Bibliography";
  const needsHangingIndent = options.hangingIndent !== false;
  const paragraphs = citations.map((citation) => {
    return createParagraph(citation, {
      spacing: { after: 0, line: 480 },
      indent: needsHangingIndent ? { left: 720, hanging: 720 } : {}
    });
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${createParagraph(heading, { bold: true, spacing: { after: 0, line: 480 } })}
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function textToBytes(text) {
  return new TextEncoder().encode(text);
}

const crcTable = Array.from({ length: 256 }, (unused, tableIndex) => {
  let checksum = tableIndex;

  for (let bit = 0; bit < 8; bit += 1) {
    checksum = checksum & 1 ? 0xedb88320 ^ (checksum >>> 1) : checksum >>> 1;
  }

  return checksum >>> 0;
});

function calculateCrc32(bytes) {
  let checksum = 0xffffffff;

  bytes.forEach((byte) => {
    checksum = crcTable[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  });

  return (checksum ^ 0xffffffff) >>> 0;
}

function writeNumber(bytes, offset, value, length) {
  for (let index = 0; index < length; index += 1) {
    bytes[offset + index] = (value >>> (index * 8)) & 0xff;
  }
}

function getZipDateParts() {
  const now = new Date();

  return {
    time: (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2),
    date: ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  };
}

function createZipFile(files) {
  const zipDate = getZipDateParts();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  files.forEach((file) => {
    const nameBytes = textToBytes(file.name);
    const contentBytes = textToBytes(file.content);
    const crc = calculateCrc32(contentBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeNumber(localHeader, 0, 0x04034b50, 4);
    writeNumber(localHeader, 4, 20, 2);
    writeNumber(localHeader, 10, zipDate.time, 2);
    writeNumber(localHeader, 12, zipDate.date, 2);
    writeNumber(localHeader, 14, crc, 4);
    writeNumber(localHeader, 18, contentBytes.length, 4);
    writeNumber(localHeader, 22, contentBytes.length, 4);
    writeNumber(localHeader, 26, nameBytes.length, 2);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeNumber(centralHeader, 0, 0x02014b50, 4);
    writeNumber(centralHeader, 4, 20, 2);
    writeNumber(centralHeader, 6, 20, 2);
    writeNumber(centralHeader, 12, zipDate.time, 2);
    writeNumber(centralHeader, 14, zipDate.date, 2);
    writeNumber(centralHeader, 16, crc, 4);
    writeNumber(centralHeader, 20, contentBytes.length, 4);
    writeNumber(centralHeader, 24, contentBytes.length, 4);
    writeNumber(centralHeader, 28, nameBytes.length, 2);
    writeNumber(centralHeader, 42, localOffset, 4);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, contentBytes);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + contentBytes.length;
  });

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const endRecord = new Uint8Array(22);
  writeNumber(endRecord, 0, 0x06054b50, 4);
  writeNumber(endRecord, 8, files.length, 2);
  writeNumber(endRecord, 10, files.length, 2);
  writeNumber(endRecord, 12, centralSize, 4);
  writeNumber(endRecord, 16, localOffset, 4);

  return new Blob([...localParts, ...centralParts, endRecord], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}

function createDocxFile(citations, options = {}) {
  return createZipFile([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    },
    {
      name: "word/document.xml",
      content: createDocumentXml(citations, options)
    }
  ]);
}

function escapePdfText(text) {
  return String(text || "");
}

function getPdfWinAnsiByte(character) {
  const code = character.charCodeAt(0);
  const winAnsi = {
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2013: 0x96,
    0x2014: 0x97,
    0x2026: 0x85
  };

  if (winAnsi[code]) {
    return winAnsi[code];
  }

  if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
    return code;
  }

  return 63;
}

function getPdfHexText(text) {
  return Array.from(escapePdfText(text)).map((character) => {
    return getPdfWinAnsiByte(character).toString(16).padStart(2, "0").toUpperCase();
  }).join("");
}

function getPdfTextWidth(text) {
  return Array.from(text || "").reduce((width, character) => {
    if (character === " ") {
      return width + 3;
    }

    if (/[A-Z0-9]/.test(character)) {
      return width + 6.7;
    }

    if (/[.,;:!?'"()[\]-]/.test(character)) {
      return width + 3.4;
    }

    return width + 5.7;
  }, 0);
}

function getPdfSegmentLines(segments, firstLineWidth, hangingLineWidth) {
  const lines = [];
  let line = [];
  let lineWidth = 0;

  segments.forEach((segment) => {
    String(segment.text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).forEach((word) => {
      const text = line.length ? ` ${word}` : word;
      const textWidth = getPdfTextWidth(text);
      const maxWidth = lines.length ? hangingLineWidth : firstLineWidth;

      if (line.length && lineWidth + textWidth > maxWidth) {
        lines.push(line);
        line = [{ text: word, italic: segment.italic }];
        lineWidth = getPdfTextWidth(word);
        return;
      }

      line.push({ text, italic: segment.italic });
      lineWidth += textWidth;
    });
  });

  if (line.length) {
    lines.push(line);
  }

  return lines.length ? lines : [[{ text: "", italic: false }]];
}

function buildPdfContent(lines) {
  return lines.map((line) => {
    let x = line.x;
    const parts = line.segments.map((segment) => {
      const font = line.bold ? "F2" : segment.italic ? "F3" : "F1";
      const part = `BT /${font} 12 Tf 1 0 0 1 ${x.toFixed(2)} ${line.y.toFixed(2)} Tm <${getPdfHexText(segment.text)}> Tj ET`;
      x += getPdfTextWidth(segment.text);
      return part;
    });

    return parts.join("\n");
  }).join("\n");
}

function createPdfFile(citations, options = {}) {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 72;
  const marginTop = 72;
  const marginBottom = 72;
  const lineHeight = 24;
  const hangingIndentSize = 36;
  const hangingIndent = options.hangingIndent !== false;
  const heading = options.heading || "Bibliography";
  const pages = [];
  let lines = [];
  let y = pageHeight - marginTop;

  function addLine(segments, x = marginX, bold = false) {
    if (y < marginBottom) {
      pages.push(lines);
      lines = [];
      y = pageHeight - marginTop;
    }

    lines.push({ segments, x, y, bold });
    y -= lineHeight;
  }

  addLine([{ text: heading, italic: false }], marginX, true);

  citations.forEach((citation, citationIndex) => {
    const source = Array.isArray(options.sources) ? options.sources[citationIndex] : {};
    const segments = getFormattedSegments(citation, getItalicTargets(source, options.styleValue));
    const wrappedLines = getPdfSegmentLines(segments, pageWidth - marginX * 2, pageWidth - marginX * 2 - hangingIndentSize);

    wrappedLines.forEach((lineSegments, index) => {
      addLine(lineSegments, hangingIndent && index > 0 ? marginX + hangingIndentSize : marginX);
    });
  });

  if (lines.length) {
    pages.push(lines);
  }

  const objects = [];
  const pageObjectNumbers = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>");

  pages.forEach((pageLines) => {
    const content = buildPdfContent(pageLines);
    const contentObjectNumber = objects.length + 1;
    const pageObjectNumber = contentObjectNumber + 1;
    objects.push(`<< /Length ${textToBytes(content).length} >>\nstream\n${content}\nendstream`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`);
    pageObjectNumbers.push(pageObjectNumber);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((pageNumber) => `${pageNumber} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(textToBytes(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = textToBytes(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

window.AutoCiteExport = {
  getSortedBibliographyCitations,
  getBibliographyEntries,
  getBibliographySources,
  getBibliographyHeading,
  getBibliographyText,
  getBibliographyHtml,
  getBibliographyRtf,
  createHangingIndentHtml,
  createHangingIndentRtf,
  downloadBlob,
  createDocxFile,
  createPdfFile
};
})();
