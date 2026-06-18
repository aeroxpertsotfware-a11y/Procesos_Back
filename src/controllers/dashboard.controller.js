const CertificationExpediente = require("../models/CertificationExpediente");

const documentKeys = [
  "camaraComercio",
  "ruas",
  "reta",
  "hojaVidaJefePilotos",
  "hojaVidaGerenteSeguridad",
];

const processLabelMap = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  aprobado: "Aprobado",
  rechazado: "Requiere ajustes",
};

const getUserIdFromRequest = (req) => req.user?.id || req.user?._id?.toString() || null;

const buildEmptyResumen = () => ({
  estadoProceso: "Pendiente",
  progreso: 0,
  documentosCargados: 0,
  documentosPendientes: documentKeys.length,
  observaciones: 0,
  ultimaActualizacion: new Date(),
});

const calculateExpedienteMetrics = (expediente) => {
  if (!expediente) {
    return buildEmptyResumen();
  }

  const documentos = expediente.documentos || {};
  const documentosCargados = documentKeys.filter((key) => {
    const status = documentos[key]?.status || "pendiente";
    return status !== "pendiente";
  }).length;
  const documentosPendientes = documentKeys.length - documentosCargados;
  const progreso = Math.round((documentosCargados / documentKeys.length) * 100);

  return {
    estadoProceso: processLabelMap[expediente.estadoProceso] || "Pendiente",
    progreso,
    documentosCargados,
    documentosPendientes,
    observaciones: 0,
    ultimaActualizacion: expediente.updatedAt || expediente.createdAt || new Date(),
  };
};

const getResumen = async (req, res) => {
  try {
    const usuarioId = getUserIdFromRequest(req);
    if (!usuarioId) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const expediente = await CertificationExpediente.findOne({ userId: usuarioId }).lean();
    return res.json(calculateExpedienteMetrics(expediente));
  } catch (error) {
    return res.status(500).json({
      message: "Error interno",
      details: error.message,
    });
  }
};

const getDocumentos = async (req, res) => {
  try {
    const usuarioId = getUserIdFromRequest(req);
    if (!usuarioId) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const expediente = await CertificationExpediente.findOne({ userId: usuarioId }).lean();
    const documentos = documentKeys.map((key) => ({
      tipo: key,
      ...(expediente?.documentos?.[key] || {
        url: "",
        status: "pendiente",
        uploadedAt: null,
      }),
    }));

    return res.json({ documentos });
  } catch (error) {
    return res.status(500).json({
      message: "Error interno",
      details: error.message,
    });
  }
};

const getEstado = async (req, res) => {
  try {
    const usuarioId = getUserIdFromRequest(req);
    if (!usuarioId) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const expediente = await CertificationExpediente.findOne({ userId: usuarioId }).lean();
    const resumen = calculateExpedienteMetrics(expediente);

    return res.json({
      estado: resumen.estadoProceso,
      progreso: resumen.progreso,
      observaciones: resumen.observaciones,
      ultimaActualizacion: resumen.ultimaActualizacion,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error interno",
      details: error.message,
    });
  }
};

module.exports = {
  getResumen,
  getDocumentos,
  getEstado,
};
