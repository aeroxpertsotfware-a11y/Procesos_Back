const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const TEMPLATE_PATH = path.join(__dirname, "..", "templates", "base", "Doc2.docx");

const loadTemplateDocxBuffer = () => {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error("No se encontro el template base Doc2.docx");
  }

  return fs.readFileSync(TEMPLATE_PATH);
};

const getDocxXmlEntries = (zip) =>
  zip.file(/word\/(document|header\d+|footer\d+)\.xml/) || [];

const extractPlaceholdersFromBuffer = (templateBuffer) => {
  if (!Buffer.isBuffer(templateBuffer)) {
    throw new Error("El template DOCX debe ser un Buffer valido");
  }

  const zip = new PizZip(templateBuffer);
  const xmlEntries = getDocxXmlEntries(zip);
  const found = new Set();
  const pattern = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

  for (const entry of xmlEntries) {
    const xml = entry.asText();
    let match = pattern.exec(xml);
    while (match) {
      found.add(match[1]);
      match = pattern.exec(xml);
    }
  }

  return [...found];
};

const assertDocxPlaceholders = (templateBuffer, expectedKeys = []) => {
  const available = extractPlaceholdersFromBuffer(templateBuffer);
  const missing = expectedKeys.filter((key) => !available.includes(String(key || "").trim()));

  if (missing.length) {
    throw new Error(
      `El template Doc2.docx no contiene los placeholders requeridos: ${missing.join(", ")}`
    );
  }

  return available;
};

const renderDocxWithData = (templateBuffer, dataMap = {}) => {
  if (!Buffer.isBuffer(templateBuffer)) {
    throw new Error("El template DOCX debe ser un Buffer valido");
  }

  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    delimiters: {
      start: "{{",
      end: "}}",
    },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter() {
      return "";
    },
  });

  doc.render(dataMap);
  return doc.getZip().generate({ type: "nodebuffer" });
};

module.exports = {
  loadTemplateDocxBuffer,
  extractPlaceholdersFromBuffer,
  assertDocxPlaceholders,
  renderDocxWithData,
};
