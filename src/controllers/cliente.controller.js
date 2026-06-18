const multer = require("multer");
const ActivationCode = require("../models/ActivationCode");
const CertificationExpediente = require("../models/CertificationExpediente");
const User = require("../models/User");
const { getSignedUrl, uploadFile } = require("../services/r2.service");

const DOCUMENT_KEYS = [
  "camaraComercio",
  "ruas",
  "reta",
  "hojaVidaJefePilotos",
  "hojaVidaGerenteSeguridad",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const buildDefaultCompanyData = () => ({
  razonSocial: "",
  nit: "",
  direccion: "",
  telefono: "",
  emailEmpresa: "",
  tipoOperacion: [],
  actividadCIIU: [],
  fechaRegistro: null,
});

const ensureExpediente = async (userId) => {
  let expediente = await CertificationExpediente.findOne({ userId });

  if (!expediente) {
    expediente = await CertificationExpediente.create({
      userId,
      companyData: buildDefaultCompanyData(),
    });
  }

  return expediente;
};

const processLabelMap = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

const hydrateSignedUrls = async (expediente) => {
  let hasChanges = false;

  for (const documentKey of DOCUMENT_KEYS) {
    const documentData = expediente.documentos?.[documentKey];
    if (!documentData?.key) {
      continue;
    }

    const signedUrl = await getSignedUrl(documentData.key);
    if (documentData.url !== signedUrl) {
      documentData.url = signedUrl;
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await expediente.save();
  }

  return expediente;
};

const serializeExpediente = (expediente) => {
  const documentos = {};
  const companyData =
    typeof expediente.companyData?.toObject === "function"
      ? expediente.companyData.toObject()
      : expediente.companyData || {};

  for (const documentKey of DOCUMENT_KEYS) {
    const documentData = expediente.documentos?.[documentKey];
    documentos[documentKey] = {
      url: documentData?.url || "",
      status: documentData?.status || "pendiente",
      uploadedAt: documentData?.uploadedAt || null,
    };
  }

  const uploadedCount = Object.values(documentos).filter(
    (item) => item.status !== "pendiente"
  ).length;
  const totalDocuments = DOCUMENT_KEYS.length;
  const progress = Math.round((uploadedCount / totalDocuments) * 100);

  return {
    _id: expediente._id,
    userId: expediente.userId,
    companyData: {
      ...buildDefaultCompanyData(),
      ...companyData,
    },
    documentos,
    estadoProceso: expediente.estadoProceso,
    estadoProcesoLabel: processLabelMap[expediente.estadoProceso] || "Pendiente",
    metrics: {
      uploadedCount,
      totalDocuments,
      progress,
      pendingCount: totalDocuments - uploadedCount,
    },
    createdAt: expediente.createdAt,
    updatedAt: expediente.updatedAt,
  };
};

const activateCliente = async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    if (!code) {
      return res.status(400).json({
        ok: false,
        message: "Codigo invalido o no asignado a este usuario.",
      });
    }

    const activationCode = await ActivationCode.findOne({ code });
    if (!activationCode) {
      return res.status(400).json({
        ok: false,
        message: "Codigo invalido o no asignado a este usuario.",
      });
    }

    if (activationCode.status !== "active") {
      return res.status(400).json({
        ok: false,
        message: "Codigo invalido o no asignado a este usuario.",
      });
    }

    const activationBelongsToUser =
      activationCode.userId?.toString() === req.user._id.toString();
    const userHasLinkedCode =
      req.user.activationCodeId?.toString() === activationCode._id.toString();

    if (!activationBelongsToUser && !userHasLinkedCode) {
      return res.status(400).json({
        ok: false,
        message: "Codigo invalido o no asignado a este usuario.",
      });
    }

    if (activationCode.expiresAt && activationCode.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        ok: false,
        message: "Codigo invalido o no asignado a este usuario.",
      });
    }

    const now = new Date();
    if (!activationBelongsToUser && userHasLinkedCode) {
      activationCode.userId = req.user._id;
    }
    activationCode.status = "used";
    activationCode.usedAt = now;
    await activationCode.save();

    await User.findByIdAndUpdate(req.user._id, {
      isActivated: true,
      activatedAt: now,
      activationCodeId: activationCode._id,
    });

    return res.json({
      ok: true,
      isActivated: true,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible activar el acceso",
      details: error.message,
    });
  }
};

const getExpediente = async (req, res) => {
  try {
    const expediente = await ensureExpediente(req.user._id);
    await hydrateSignedUrls(expediente);

    return res.json({
      expediente: serializeExpediente(expediente),
    });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible cargar el expediente",
      details: error.message,
    });
  }
};

const saveCompanyData = async (req, res) => {
  try {
    const payload = req.body || {};
    const actividadCIIU = Array.isArray(payload.actividadCIIU)
      ? payload.actividadCIIU
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : [];
    const tipoOperacion = Array.isArray(payload.tipoOperacion)
      ? payload.tipoOperacion
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : String(payload.tipoOperacion || "").trim()
        ? [String(payload.tipoOperacion || "").trim()]
        : [];

    const companyData = {
      razonSocial: String(payload.razonSocial || "").trim(),
      nit: String(payload.nit || "").trim(),
      direccion: String(payload.direccion || "").trim(),
      telefono: String(payload.telefono || "").trim(),
      emailEmpresa: String(payload.emailEmpresa || "").trim().toLowerCase(),
      tipoOperacion,
      actividadCIIU,
      fechaRegistro: payload.fechaRegistro ? new Date(payload.fechaRegistro) : null,
    };

    if (!companyData.tipoOperacion.length) {
      return res.status(400).json({
        message: "El tipo de operación es obligatorio",
      });
    }

    if (companyData.fechaRegistro && Number.isNaN(companyData.fechaRegistro.getTime())) {
      return res.status(400).json({
        message: "La fecha de registro es inválida",
      });
    }

    const expediente = await ensureExpediente(req.user._id);
    expediente.companyData = companyData;
    await expediente.save();
    await hydrateSignedUrls(expediente);

    return res.json({
      message: "Datos de empresa guardados correctamente",
      expediente: serializeExpediente(expediente),
    });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible guardar los datos de empresa",
      details: error.message,
    });
  }
};

const uploadDocumento = async (req, res) => {
  try {
    const tipoDocumento = String(req.body?.tipoDocumento || "").trim();
    const archivo = req.file;

    if (!DOCUMENT_KEYS.includes(tipoDocumento)) {
      return res.status(400).json({
        message: "Tipo de documento inválido",
      });
    }

    if (!archivo) {
      return res.status(400).json({
        message: "Debes adjuntar un archivo PDF",
      });
    }

    if (archivo.mimetype !== "application/pdf") {
      return res.status(400).json({
        message: "Solo se permiten archivos PDF",
      });
    }

    const expediente = await ensureExpediente(req.user._id);
    const { key } = await uploadFile(
      archivo.buffer,
      `${req.user._id}-${tipoDocumento}-${archivo.originalname}`,
      archivo.mimetype
    );
    const signedUrl = await getSignedUrl(key);

    expediente.documentos[tipoDocumento] = {
      key,
      url: signedUrl,
      status: "cargado",
      uploadedAt: new Date(),
    };
    await expediente.save();

    return res.json({
      message: "Documento cargado correctamente",
      tipoDocumento,
      url: signedUrl,
      expediente: serializeExpediente(expediente),
    });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible cargar el documento",
      details: error.message,
    });
  }
};

module.exports = {
  upload,
  activateCliente,
  getExpediente,
  saveCompanyData,
  uploadDocumento,
};
