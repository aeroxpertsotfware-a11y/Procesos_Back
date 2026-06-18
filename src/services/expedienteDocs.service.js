const path = require("path");
const CertificationExpediente = require("../models/CertificationExpediente");
const ExpedienteDocumento = require("../models/ExpedienteDocumento");
const { uploadFile, getSignedUrl, buildSafeFileName, deleteFile } = require("./r2.service");

const allowedTipos = ["DIS", "MANUAL_SMS", "MANUAL_OPERACIONES", "MCM", "MMP", "OTRO"];
const DIS_FILENAME =
  "MAUT-5.0-12-081-FO-DECLARACINDEINTENCINDESOLICITUD-DISPARAEXPLOTADORAERONAVESNOTRIPULADAS_V.3_RFC_07-11-2025.docx";

const serializeDocumento = (documento) => {
  const source = typeof documento.toObject === "function" ? documento.toObject() : documento;

  return {
    _id: String(source._id),
    clienteId: String(source.clienteId),
    expedienteId: source.expedienteId ? String(source.expedienteId) : null,
    tipo: source.tipo,
    nombreOriginal: source.nombreOriginal,
    nombreAlmacenado: source.nombreAlmacenado,
    r2Key: source.r2Key,
    mimeType: source.mimeType,
    size: source.size,
    estado: source.estado,
    observacion: source.observacion || "",
    creadoPor: source.creadoPor?._id ? String(source.creadoPor._id) : String(source.creadoPor || ""),
    creadoPorNombre: source.creadoPor?.nombre || "",
    creadoEn: source.creadoEn,
    actualizadoEn: source.actualizadoEn,
  };
};

const getExpedienteId = async (clienteId) => {
  const expediente = await CertificationExpediente.findOne({ userId: clienteId }).select("_id");
  return expediente?._id || null;
};

const buildR2Key = (clienteId, filename) => {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const extension = path.extname(filename || "") || ".bin";
  const basename = path.basename(filename || `documento${extension}`, extension);
  const safeFilename = buildSafeFileName(`${basename}${extension}`, extension.replace(".", ""));

  return `expedientes/${clienteId}/${month}/${Date.now()}_${safeFilename}`;
};

const uploadDocumento = async ({
  clienteId,
  tipo,
  fileBuffer,
  filename,
  mimeType,
  size,
  creadoPor,
  observacion = "",
  estado = "CARGADO",
}) => {
  if (!allowedTipos.includes(tipo)) {
    throw new Error("Tipo de documento invalido.");
  }

  const expedienteId = await getExpedienteId(clienteId);
  const r2Key = buildR2Key(clienteId, filename);
  const { key } = await uploadFile(fileBuffer, filename, mimeType, r2Key);
  const nombreAlmacenado = key.split("/").pop() || filename;

  const documento = await ExpedienteDocumento.create({
    clienteId,
    expedienteId,
    tipo,
    nombreOriginal: filename,
    nombreAlmacenado,
    r2Key: key,
    mimeType,
    size,
    estado,
    observacion: String(observacion || "").trim(),
    creadoPor,
  });

  const populated = await ExpedienteDocumento.findById(documento._id).populate(
    "creadoPor",
    "nombre email"
  );

  return serializeDocumento(populated);
};

const listDocumentos = async (clienteId) => {
  const documentos = await ExpedienteDocumento.find({ clienteId })
    .populate("creadoPor", "nombre email")
    .sort({ creadoEn: -1 });

  return documentos.map(serializeDocumento);
};

const getDownloadUrl = async (docId) => {
  const documento = await ExpedienteDocumento.findById(docId);
  if (!documento) {
    return null;
  }

  const url = await getSignedUrl(documento.r2Key);

  return {
    url,
    filename: documento.tipo === "DIS" ? DIS_FILENAME : documento.nombreOriginal,
    mimeType: documento.mimeType,
  };
};

const updateDocumento = async (docId, payload) => {
  const updates = {};

  if (payload.estado) {
    updates.estado = payload.estado;
  }
  if (typeof payload.observacion === "string") {
    updates.observacion = payload.observacion.trim();
  }

  const documento = await ExpedienteDocumento.findByIdAndUpdate(docId, updates, {
    new: true,
    runValidators: true,
  }).populate("creadoPor", "nombre email");

  return documento ? serializeDocumento(documento) : null;
};

const deleteDocumento = async (docId) => {
  const documento = await ExpedienteDocumento.findById(docId);
  if (!documento) {
    return null;
  }

  await deleteFile(documento.r2Key);
  await ExpedienteDocumento.deleteOne({ _id: docId });

  return {
    _id: String(documento._id),
    nombreOriginal: documento.nombreOriginal,
  };
};

module.exports = {
  allowedTipos,
  uploadDocumento,
  listDocumentos,
  getDownloadUrl,
  updateDocumento,
  deleteDocumento,
  serializeDocumento,
  DIS_FILENAME,
};
