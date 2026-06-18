const fs = require("fs");
const path = require("path");

const TEMPLATE_BY_KEY = {
  sms: "sms.template.json",
  mo: "mo.template.json",
  mcm: "mcm.template.json",
  mmp: "mmp.template.json",
};

const loadManualTemplate = (manualKey) => {
  const normalizedKey = String(manualKey || "").trim().toLowerCase();
  const filename = TEMPLATE_BY_KEY[normalizedKey];

  if (!filename) {
    throw new Error(`Template no soportado para manualKey: ${normalizedKey}`);
  }

  const filePath = path.join(__dirname, "..", "templates", "manuales", filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontro template: ${filename}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
};

module.exports = {
  loadManualTemplate,
};
