const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const TEMPLATE_PATH = path.join(__dirname, "..", "templates", "DIS_template.docx");

const normalizeValue = (value) => String(value || "").trim();

const formatDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
};

const escapeXml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const getTemplateZip = () => {
  const content = fs.readFileSync(TEMPLATE_PATH, "binary");
  return new PizZip(content);
};

const getTableRows = (tableXml) =>
  [...tableXml.matchAll(/<w:tr[\s\S]*?<\/w:tr>/g)].map((match) => match[0]);

const getRowCells = (rowXml) =>
  [...rowXml.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((match) => match[0]);

const buildParagraphXml = (text) => {
  const lines = String(text || "").split("\n");
  if (lines.length === 0) {
    return '<w:p/>';
  }

  return lines
    .map(
      (line) =>
        `<w:p><w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(
          line || " "
        )}</w:t></w:r></w:p>`
    )
    .join("");
};

const replaceCellText = (cellXml, text) => {
  const tcPrMatch = cellXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
  const tcPr = tcPrMatch ? tcPrMatch[0] : "";
  return `<w:tc>${tcPr}${buildParagraphXml(text)}</w:tc>`;
};

const appendCellText = (cellXml, text) => {
  if (!text) {
    return cellXml;
  }

  return cellXml.replace(/<\/w:tc>$/, `${buildParagraphXml(text)}</w:tc>`);
};

const replaceRowCells = (rowXml, valuesByIndex) => {
  const cells = getRowCells(rowXml);
  if (cells.length === 0) {
    return rowXml;
  }

  let nextRow = rowXml;
  cells.forEach((cell, index) => {
    if (!Object.prototype.hasOwnProperty.call(valuesByIndex, index)) {
      return;
    }

    nextRow = nextRow.replace(cell, replaceCellText(cell, valuesByIndex[index]));
  });

  return nextRow;
};

const replaceTableRows = (tableXml, rowReplacements) => {
  const rows = getTableRows(tableXml);
  if (rows.length === 0) {
    return tableXml;
  }

  let nextTable = tableXml;
  rows.forEach((row, index) => {
    if (!Object.prototype.hasOwnProperty.call(rowReplacements, index)) {
      return;
    }

    nextTable = nextTable.replace(row, replaceRowCells(row, rowReplacements[index]));
  });

  return nextTable;
};

const replaceFirstTextInSdt = (sdtXml, nextValue) => {
  return sdtXml.replace(/<w:t[^>]*>[\s\S]*?<\/w:t>/, `<w:t>${escapeXml(nextValue)}</w:t>`);
};

const markCheckboxControlsInCell = (cellXml, checkedIndexes) => {
  const sdtBlocks = [...cellXml.matchAll(/<w:sdt>[\s\S]*?<\/w:sdt>/g)].map((match) => match[0]);
  if (sdtBlocks.length === 0) {
    return cellXml;
  }

  let nextCell = cellXml;
  sdtBlocks.forEach((sdt, index) => {
    const checked = checkedIndexes.includes(index);
    const nextSdt = replaceFirstTextInSdt(sdt, checked ? "☒" : "☐");
    nextCell = nextCell.replace(sdt, nextSdt);
  });

  return nextCell;
};

const replaceTextInCell = (cellXml, searchText, replacement) => {
  const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return cellXml.replace(new RegExp(escapedSearch), escapeXml(replacement));
};

const getTemplatePlaceholders = () => {
  const zip = getTemplateZip();
  const xmlFiles = Object.keys(zip.files).filter(
    (fileName) =>
      fileName.startsWith("word/") &&
      fileName.endsWith(".xml") &&
      !fileName.includes("settings") &&
      !fileName.includes("fontTable") &&
      !fileName.includes("styles")
  );

  const matches = new Set();
  for (const fileName of xmlFiles) {
    const xmlContent = zip.file(fileName)?.asText() || "";
    const placeholders = xmlContent.match(/\{[^{}]+\}/g) || [];
    for (const placeholder of placeholders) {
      const normalized = placeholder.slice(1, -1).trim();
      if (!/^[a-zA-Z0-9_.\[\]-]+$/.test(normalized)) {
        continue;
      }
      if (/^[0-9A-Fa-f-]{20,}$/.test(normalized)) {
        continue;
      }
      matches.add(normalized);
    }
  }

  return Array.from(matches);
};

const buildMissingFields = ({ client, expediente, dis }) => {
  const missing = [];

  if (!normalizeValue(expediente?.companyData?.razonSocial || dis?.sectionA?.nombreSolicitanteOrganizacion)) {
    missing.push("razonSocial");
  }
  if (!normalizeValue(expediente?.companyData?.nit || dis?.sectionA?.nit)) {
    missing.push("nit");
  }
  if (!normalizeValue(dis?.sectionC?.tipoSolicitud)) {
    missing.push("tipoSolicitud");
  }
  if (!Array.isArray(dis?.sectionC?.tiposOperacion) || dis.sectionC.tiposOperacion.length === 0) {
    missing.push("tiposOperacion");
  }
  if (!Array.isArray(dis?.sectionB?.personalGestion) || dis.sectionB.personalGestion.length === 0) {
    missing.push("personalGestion");
  }
  if (!Array.isArray(dis?.sectionD?.uas) || dis.sectionD.uas.length === 0) {
    missing.push("uas");
  }
  if (!Array.isArray(dis?.sectionE?.eta) || dis.sectionE.eta.length === 0) {
    missing.push("eta");
  }
  if (!normalizeValue(dis?.sectionG?.nombreDeclarante)) {
    missing.push("nombreDeclarante");
  }
  if (!normalizeValue(dis?.sectionG?.cargo)) {
    missing.push("cargoDeclarante");
  }
  if (!formatDate(dis?.sectionG?.fecha)) {
    missing.push("fechaDeclaracion");
  }
  if (!normalizeValue(client?.email)) {
    missing.push("emailCliente");
  }

  return missing;
};

const buildTemplateData = ({ client, expediente, dis }) => {
  const razonSocial =
    normalizeValue(dis?.sectionA?.nombreSolicitanteOrganizacion) ||
    normalizeValue(expediente?.companyData?.razonSocial) ||
    normalizeValue(client?.nombre);
  const nit =
    normalizeValue(dis?.sectionA?.nit) || normalizeValue(expediente?.companyData?.nit);
  const tipoOperacionEmpresa = Array.isArray(expediente?.companyData?.tipoOperacion)
    ? expediente.companyData.tipoOperacion
    : [];
  const personalGestion = Array.isArray(dis?.sectionB?.personalGestion)
    ? dis.sectionB.personalGestion
    : [];
  const uas = Array.isArray(dis?.sectionD?.uas) ? dis.sectionD.uas : [];
  const eta = Array.isArray(dis?.sectionE?.eta) ? dis.sectionE.eta : [];
  const tiposOperacion = Array.isArray(dis?.sectionC?.tiposOperacion)
    ? dis.sectionC.tiposOperacion
    : [];
  const vuelosEspeciales = Array.isArray(dis?.sectionC?.vuelosEspeciales)
    ? dis.sectionC.vuelosEspeciales
    : [];

  return {
    razonSocial,
    nombreSolicitanteOrganizacion: razonSocial,
    nit,
    emailCliente: normalizeValue(client?.email),
    direccionOficinaAdministrativa: normalizeValue(dis?.sectionA?.direccionOficinaAdministrativa),
    departamento: normalizeValue(dis?.sectionA?.departamento),
    ciudad: normalizeValue(dis?.sectionA?.ciudad),
    lugarInspeccionOperacional: normalizeValue(dis?.sectionA?.lugarInspeccionOperacional),
    departamentoInspeccion: normalizeValue(dis?.sectionA?.departamentoInspeccion),
    ciudadInspeccion: normalizeValue(dis?.sectionA?.ciudadInspeccion),
    telefonoEmpresa: normalizeValue(expediente?.companyData?.telefono),
    emailEmpresa: normalizeValue(expediente?.companyData?.emailEmpresa),
    fechaRegistroEmpresa: formatDate(expediente?.companyData?.fechaRegistro),
    actividadCIIU: Array.isArray(expediente?.companyData?.actividadCIIU)
      ? expediente.companyData.actividadCIIU.join(", ")
      : "",
    tipoSolicitud: normalizeValue(dis?.sectionC?.tipoSolicitud),
    normativaRAC100: dis?.sectionC?.normativaRAC100 ? "Si" : "No",
    serviciosComerciales: dis?.sectionC?.serviciosComerciales ? "Si" : "No",
    tipoContactoVisual: normalizeValue(dis?.sectionC?.tipoContactoVisual),
    tiposOperacion: tiposOperacion.join(", "),
    tiposOperacionEmpresa: tipoOperacionEmpresa.join(", "),
    otroTipoOperacion: normalizeValue(dis?.sectionC?.otroTipoOperacion),
    vuelosEspeciales: vuelosEspeciales.join(", "),
    otroVueloEspecial: normalizeValue(dis?.sectionC?.otroVueloEspecial),
    informacionAdicional: normalizeValue(dis?.sectionF?.informacionAdicional),
    fechaReunionOrientacion: formatDate(dis?.sectionF?.fechaReunionOrientacion),
    nombreDeclarante: normalizeValue(dis?.sectionG?.nombreDeclarante),
    cargoDeclarante: normalizeValue(dis?.sectionG?.cargo),
    fechaDeclaracion: formatDate(dis?.sectionG?.fecha),
    firmaDeclarante: normalizeValue(dis?.sectionG?.firma),
    personalGestion,
    uas,
    eta,
    personalGestionRows: personalGestion.map((item, index) => ({
      index: index + 1,
      cargo: normalizeValue(item?.cargo),
      nombre: normalizeValue(item?.nombre),
      correoElectronico: normalizeValue(item?.correoElectronico),
      telefono: normalizeValue(item?.telefono),
    })),
    uasRows: uas.map((item, index) => ({
      index: index + 1,
      marca: normalizeValue(item?.marca),
      modelo: normalizeValue(item?.modelo),
      cantidad: Number(item?.cantidad || 0),
      pbmo: normalizeValue(item?.pbmo),
      posesion: normalizeValue(item?.posesion),
      tipoOperacion: normalizeValue(item?.tipoOperacion),
      numeroRegistroRUAS: normalizeValue(item?.numeroRegistroRUAS),
    })),
    etaRows: eta.map((item, index) => ({
      index: index + 1,
      marca: normalizeValue(item?.marca),
      modelo: normalizeValue(item?.modelo),
      cantidad: Number(item?.cantidad || 0),
      posesion: normalizeValue(item?.posesion),
      tipoOperacion: normalizeValue(item?.tipoOperacion),
      numeroRegistroRETA: normalizeValue(item?.numeroRegistroRETA),
    })),
  };
};

const buildOperationSummary = (data) => {
  const values = [
    `Normativa RAC 100: ${data.normativaRAC100}`,
    `Tipo de solicitud: ${data.tipoSolicitud}`,
    `Servicios comerciales: ${data.serviciosComerciales}`,
  ];

  return values.join("\n");
};

const buildOperationTypesSummary = (data) => {
  const values = [`Tipos de operacion: ${data.tiposOperacion || "Sin registrar"}`];
  if (data.otroTipoOperacion) {
    values.push(`Otra operacion: ${data.otroTipoOperacion}`);
  }
  if (data.tiposOperacionEmpresa) {
    values.push(`Tipos de operacion empresa: ${data.tiposOperacionEmpresa}`);
  }
  return values.join("\n");
};

const buildFlightSummary = (data) => {
  const values = [
    `Tipo de contacto visual: ${data.tipoContactoVisual || "Sin registrar"}`,
    `Vuelos especiales: ${data.vuelosEspeciales || "Sin registrar"}`,
  ];
  if (data.otroVueloEspecial) {
    values.push(`Otro vuelo especial: ${data.otroVueloEspecial}`);
  }
  return values.join("\n");
};

const getCheckedIndexes = (sourceOptions, selectedOptions) =>
  sourceOptions.reduce((indexes, option, index) => {
    if (selectedOptions.includes(option)) {
      indexes.push(index);
    }
    return indexes;
  }, []);

const buildManualTemplateBuffer = ({ client, expediente, dis }) => {
  const data = buildTemplateData({ client, expediente, dis });
  const zip = getTemplateZip();
  const documentXml = zip.file("word/document.xml")?.asText();

  if (!documentXml) {
    const error = new Error("No fue posible leer la plantilla DIS.");
    error.code = "TEMPLATE_READ_ERROR";
    throw error;
  }

  const tables = [...documentXml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].map((match) => match[0]);
  if (tables.length < 2) {
    const error = new Error("La estructura de la plantilla DIS no es valida.");
    error.code = "TEMPLATE_STRUCTURE_ERROR";
    throw error;
  }

  const managementRows = [
    "Ejecutivo responsable",
    "Jefe de pilotos",
    "Gerente Seguridad Operacional - SMS",
    "Responsable gestion mantenimiento",
  ].map((role) =>
    data.personalGestionRows.find((item) => normalizeValue(item.cargo) === role) || {
      nombre: "",
      correoElectronico: "",
      telefono: "",
    }
  );

  const uasRows = [...data.uasRows];
  while (uasRows.length < 3) {
    uasRows.push({
      marca: "",
      modelo: "",
      cantidad: "",
      pbmo: "",
      posesion: "",
      tipoOperacion: "",
      numeroRegistroRUAS: "",
    });
  }

  const etaRows = [...data.etaRows];
  while (etaRows.length < 3) {
    etaRows.push({
      marca: "",
      modelo: "",
      cantidad: "",
      posesion: "",
      tipoOperacion: "",
      numeroRegistroRETA: "",
    });
  }

  const requestTypeOptions = [
    "Certificacion inicial",
    "Modificacion permiso",
    "Adicion permiso",
  ];
  const operationOptions = [
    "Simple captura de imagenes o datos",
    "Vigilancia y seguridad privada",
    "Medios de comunicacion masiva",
    "Aspersion",
    "Dispersion",
    "Enjambre",
    "Transporte de carga",
    "Transporte mercancias peligrosas",
    "Instruccion",
    "Otra",
  ];
  const contactOptions = ["VLOS", "EVLOS", "BVLOS"];
  const specialFlightOptions = [
    "Vuelo nocturno",
    "Zona urbana",
    "Vuelo automatico",
    "Demostraciones comerciales",
    "Competencias",
    "UA cautiva",
    "Otro",
  ];

  let table1 = replaceTableRows(tables[0], {
    7: {
      1: managementRows[0].nombre,
      2: [managementRows[0].correoElectronico, managementRows[0].telefono].filter(Boolean).join("\n"),
    },
    8: {
      1: managementRows[1].nombre,
      2: [managementRows[1].correoElectronico, managementRows[1].telefono].filter(Boolean).join("\n"),
    },
    9: {
      1: managementRows[2].nombre,
      2: [managementRows[2].correoElectronico, managementRows[2].telefono].filter(Boolean).join("\n"),
    },
    10: {
      1: managementRows[3].nombre,
      2: [managementRows[3].correoElectronico, managementRows[3].telefono].filter(Boolean).join("\n"),
    },
  });

  const table1Rows = getTableRows(table1);
  const row3Cells = getRowCells(table1Rows[2]);
  const row4Cells = getRowCells(table1Rows[3]);
  const row5Cells = getRowCells(table1Rows[4]);
  const row13Cells = getRowCells(table1Rows[12]);
  const row14Cells = getRowCells(table1Rows[13]);

  const cell13LeftChecked = [
    ...(data.normativaRAC100 === "Si" ? [0] : []),
    ...getCheckedIndexes(requestTypeOptions, [data.tipoSolicitud]).map((index) => index + 1),
    ...(data.serviciosComerciales === "Si" ? [4] : [5]),
  ];
  const cell13RightChecked = getCheckedIndexes(operationOptions, data.tiposOperacion.split(", ").filter(Boolean));
  const cell14LeftChecked = [
    ...getCheckedIndexes(contactOptions, data.tipoContactoVisual ? [data.tipoContactoVisual] : []),
    ...getCheckedIndexes(specialFlightOptions, data.vuelosEspeciales.split(", ").filter(Boolean)).map(
      (index) => index + 3
    ),
  ];

  let row13LeftCell = markCheckboxControlsInCell(row13Cells[0], cell13LeftChecked);
  let row13RightCell = markCheckboxControlsInCell(row13Cells[1], cell13RightChecked);
  let row14LeftCell = markCheckboxControlsInCell(row14Cells[0], cell14LeftChecked);

  const nextRow3 = table1Rows[2].replace(
    row3Cells[0],
    appendCellText(row3Cells[0], `${data.nombreSolicitanteOrganizacion}\nNIT: ${data.nit}`)
  );
  const nextRow4 = table1Rows[3]
    .replace(row4Cells[0], appendCellText(row4Cells[0], data.direccionOficinaAdministrativa))
    .replace(
      row4Cells[1],
      appendCellText(
        row4Cells[1],
        `${data.departamento}${data.ciudad ? ` - ${data.ciudad}` : ""}`
      )
    );
  const nextRow5 = table1Rows[4]
    .replace(row5Cells[0], appendCellText(row5Cells[0], data.lugarInspeccionOperacional))
    .replace(
      row5Cells[1],
      appendCellText(
        row5Cells[1],
        `${data.departamentoInspeccion}${data.ciudadInspeccion ? ` - ${data.ciudadInspeccion}` : ""}`
      )
    );

  if (data.otroTipoOperacion) {
    row13RightCell = replaceTextInCell(
      row13RightCell,
      "____________________ _____________",
      data.otroTipoOperacion
    );
  }

  if (data.otroVueloEspecial) {
    row14LeftCell = replaceTextInCell(
      row14LeftCell,
      "___________________________",
      data.otroVueloEspecial
    );
  }

  const nextRow13 = table1Rows[12]
    .replace(row13Cells[0], row13LeftCell)
    .replace(row13Cells[1], row13RightCell);
  const nextRow14 = table1Rows[13].replace(row14Cells[0], row14LeftCell);

  table1 = table1.replace(table1Rows[12], nextRow13).replace(table1Rows[13], nextRow14);

  const uasOverflow = data.uasRows.length > 3 ? data.uasRows.slice(3).map((item, index) =>
    `${index + 4}. ${item.marca} | ${item.modelo} | ${item.cantidad} | ${item.pbmo} | ${item.posesion} | ${item.tipoOperacion} | ${item.numeroRegistroRUAS}`
  ).join("\n") : "";

  const etaOverflow = data.etaRows.length > 3 ? data.etaRows.slice(3).map((item, index) =>
    `${index + 4}. ${item.marca} | ${item.modelo} | ${item.cantidad} | ${item.posesion} | ${item.tipoOperacion} | ${item.numeroRegistroRETA}`
  ).join("\n") : "";

  let table2 = replaceTableRows(tables[1], {
    2: {
      0: uasRows[0].marca,
      1: uasRows[0].modelo,
      2: String(uasRows[0].cantidad || ""),
      3: uasRows[0].pbmo,
      4: uasRows[0].posesion,
      5: uasRows[0].tipoOperacion,
      6: uasRows[0].numeroRegistroRUAS,
    },
    3: {
      0: uasRows[1].marca,
      1: uasRows[1].modelo,
      2: String(uasRows[1].cantidad || ""),
      3: uasRows[1].pbmo,
      4: uasRows[1].posesion,
      5: uasRows[1].tipoOperacion,
      6: uasRows[1].numeroRegistroRUAS,
    },
    4: {
      0: uasRows[2].marca,
      1: uasRows[2].modelo,
      2: String(uasRows[2].cantidad || ""),
      3: uasRows[2].pbmo,
      4: uasRows[2].posesion,
      5: uasRows[2].tipoOperacion,
      6: uasRows[2].numeroRegistroRUAS,
    },
    5: {
      0: uasOverflow || "Sin registros adicionales.",
    },
    8: {
      0: etaRows[0].marca,
      1: etaRows[0].modelo,
      2: String(etaRows[0].cantidad || ""),
      3: etaRows[0].posesion,
      4: etaRows[0].tipoOperacion,
      5: etaRows[0].numeroRegistroRETA,
    },
    9: {
      0: etaRows[1].marca,
      1: etaRows[1].modelo,
      2: String(etaRows[1].cantidad || ""),
      3: etaRows[1].posesion,
      4: etaRows[1].tipoOperacion,
      5: etaRows[1].numeroRegistroRETA,
    },
    10: {
      0: etaRows[2].marca,
      1: etaRows[2].modelo,
      2: String(etaRows[2].cantidad || ""),
      3: etaRows[2].posesion,
      4: etaRows[2].tipoOperacion,
      5: etaRows[2].numeroRegistroRETA,
    },
    11: {
      0: etaOverflow || "Sin registros adicionales.",
    },
  });

  const table2Rows = getTableRows(table2);
  const table2Row14Cells = getRowCells(table2Rows[13]);
  const table2Row15Cells = getRowCells(table2Rows[14]);
  const table2Row18Cells = getRowCells(table2Rows[17]);

  const table2NextRow14 = table2Rows[13].replace(
    table2Row14Cells[0],
    appendCellText(table2Row14Cells[0], data.informacionAdicional)
  );
  const table2NextRow15 = table2Rows[14].replace(
    table2Row15Cells[0],
    appendCellText(table2Row15Cells[0], data.fechaReunionOrientacion)
  );
  const table2NextRow18 = table2Rows[17]
    .replace(table2Row18Cells[0], appendCellText(table2Row18Cells[0], data.nombreDeclarante))
    .replace(table2Row18Cells[1], appendCellText(table2Row18Cells[1], data.cargoDeclarante))
    .replace(table2Row18Cells[2], appendCellText(table2Row18Cells[2], data.fechaDeclaracion))
    .replace(table2Row18Cells[3], appendCellText(table2Row18Cells[3], data.firmaDeclarante));

  let nextXml = documentXml;
  table1 = table1
    .replace(table1Rows[2], nextRow3)
    .replace(table1Rows[3], nextRow4)
    .replace(table1Rows[4], nextRow5);
  nextXml = nextXml.replace(tables[0], table1);
  table2 = table2
    .replace(table2Rows[13], table2NextRow14)
    .replace(table2Rows[14], table2NextRow15)
    .replace(table2Rows[17], table2NextRow18);
  nextXml = nextXml.replace(tables[1], table2);

  zip.file("word/document.xml", nextXml);

  return zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
};

const generateDisDocxBuffer = ({ client, expediente, dis }) => {
  const placeholders = getTemplatePlaceholders();

  try {
    if (placeholders.length === 0) {
      return buildManualTemplateBuffer({ client, expediente, dis });
    }

    const zip = getTemplateZip();
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(buildTemplateData({ client, expediente, dis }));

    return doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
  } catch (error) {
    error.code = error.code || "TEMPLATE_RENDER_ERROR";
    throw error;
  }
};

module.exports = {
  TEMPLATE_PATH,
  getTemplatePlaceholders,
  buildMissingFields,
  buildTemplateData,
  generateDisDocxBuffer,
  buildManualTemplateBuffer,
};
