const fs = require("fs");
const path = require("path");

const REFERENCES_ROOT = path.join(__dirname, "..", "templates", "manuales", "referencias");

const getManualReferencePath = (manualKey) =>
  path.join(REFERENCES_ROOT, `${String(manualKey || "").trim().toLowerCase()}-ci-aerocivil.md`);

const loadManualReference = (manualKey) => {
  const filePath = getManualReferencePath(manualKey);
  if (!fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8").trim();
};

module.exports = {
  loadManualReference,
  getManualReferencePath,
};
