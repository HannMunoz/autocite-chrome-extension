// Bibliography sorting and export helpers.

(() => {
const ExportContributors = window.AutoCiteContributors;

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

function getBibliographyText(history) {
  return getSortedBibliographyCitations(history)
    .map((savedCitation) => {
      return typeof savedCitation === "string" ? savedCitation : savedCitation.fullCitation;
    })
    .join("\n\n");
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

function createDocumentXml(citations) {
  const paragraphs = citations.map((citation) => {
    return `<w:p><w:r><w:t>${escapeXml(citation)}</w:t></w:r></w:p>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Bibliography</w:t></w:r></w:p>
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

function createDocxFile(citations) {
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
      content: createDocumentXml(citations)
    }
  ]);
}

window.AutoCiteExport = {
  getSortedBibliographyCitations,
  getBibliographyText,
  downloadBlob,
  createDocxFile
};
})();
