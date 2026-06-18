const multer = require("multer");
const User = require("../models/User");
const ExpedienteDocumento = require("../models/ExpedienteDocumento");
const {
  allowedTipos,
  uploadDocumento,
  listDocumentos,
  getDownloadUrl,
  updateDocumento,
  deleteDocumento,
} = require("../services/expedienteDocs.service");

const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

const ensureCliente = async (clienteId) => {
  const client = await User.findById(clienteId);
  if (!client || client.rol !== "cliente") {
    return null;
  }

  return client;
};

const listExpedienteDocumentos = async (req, res) => {
  try {
    const cliente = await ensureCliente(req.params.clienteId);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado." });
    }

    const documentos = await listDocumentos(req.params.clienteId);
    return res.json({ documentos });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible listar los documentos del expediente.",
      details: error.message,
    });
  }
};

const createExpedienteDocumento = async (req, res) => {
  try {
    const cliente = await ensureCliente(req.params.clienteId);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado." });
    }

    const tipo = String(req.body?.tipo || "").trim();
    const observacion = String(req.body?.observacion || "").trim();
    const estado = String(req.body?.estado || "APROBADO").trim().toUpperCase();
    const archivo = req.file;

    if (!allowedTipos.includes(tipo)) {
      return res.status(400).json({ message: "Tipo de documento invalido." });
    }

    if (!archivo) {
      return res.status(400).json({ message: "Debes adjuntar un archivo." });
    }

    if (!allowedMimeTypes.includes(archivo.mimetype)) {
      return res.status(400).json({ message: "Tipo de archivo no permitido." });
    }

    if (!["APROBADO", "RECHAZADO"].includes(estado)) {
      return res.status(400).json({ message: "Estado inicial invalido." });
    }

    if (estado === "RECHAZADO" && !observacion) {
      return res.status(400).json({
        message: "Debes registrar una observacion cuando el documento no esta aprobado.",
      });
    }

    const documento = await uploadDocumento({
      clienteId: req.params.clienteId,
      tipo,
      fileBuffer: archivo.buffer,
      filename: archivo.originalname,
      mimeType: archivo.mimetype,
      size: archivo.size,
      creadoPor: req.user._id,
      observacion,
      estado,
    });

    return res.status(201).json({ documento });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible subir el documento.",
      details: error.message,
    });
  }
};

const downloadExpedienteDocumento = async (req, res) => {
  try {
    const download = await getDownloadUrl(req.params.docId);
    if (!download) {
      return res.status(404).json({ message: "Documento no encontrado." });
    }

    return res.json(download);
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible obtener la descarga del documento.",
      details: error.message,
    });
  }
};

const patchExpedienteDocumento = async (req, res) => {
  try {
    const estado = String(req.body?.estado || "").trim();
    const observacion = req.body?.observacion;

    if (estado && !["CARGADO", "GENERADO", "APROBADO", "RECHAZADO"].includes(estado)) {
      return res.status(400).json({ message: "Estado invalido." });
    }

    const documento = await updateDocumento(req.params.docId, { estado, observacion });
    if (!documento) {
      return res.status(404).json({ message: "Documento no encontrado." });
    }

    return res.json({ documento });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible actualizar el documento.",
      details: error.message,
    });
  }
};

const deleteExpedienteDocumento = async (req, res) => {
  try {
    const deleted = await deleteDocumento(req.params.docId);
    if (!deleted) {
      return res.status(404).json({ message: "Documento no encontrado." });
    }

    return res.json({
      message: "Documento eliminado correctamente.",
      documento: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible eliminar el documento.",
      details: error.message,
    });
  }
};

module.exports = {
  upload,
  listExpedienteDocumentos,
  createExpedienteDocumento,
  downloadExpedienteDocumento,
  patchExpedienteDocumento,
  deleteExpedienteDocumento,
};
