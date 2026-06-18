const CertificationExpediente = require("../models/CertificationExpediente");
const User = require("../models/User");

const documentDefinitions = [
  { key: "camaraComercio", label: "Certificado Camara de Comercio" },
  { key: "ruas", label: "Registro UAS (RUAS)" },
  { key: "reta", label: "Registro ETA (RETA)" },
  { key: "hojaVidaJefePilotos", label: "Hoja de Vida Jefe de Pilotos" },
  { key: "hojaVidaGerenteSeguridad", label: "Hoja de Vida Gerente de Seguridad Operacional" },
];

const getUserIdFromRequest = (req) => req.user?.id || req.user?._id?.toString() || null;

const toSafeDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const getExpedienteMetrics = (expediente) => {
  const documents = expediente?.documentos || {};
  const totalDocumentos = documentDefinitions.length;
  const documentosAprobados = documentDefinitions.filter(
    ({ key }) => documents[key]?.status === "aprobado"
  ).length;
  const documentosEnRevision = documentDefinitions.filter(
    ({ key }) => documents[key]?.status === "cargado"
  ).length;
  const documentosObservados = documentDefinitions.filter(
    ({ key }) => documents[key]?.status === "rechazado"
  ).length;
  const documentosPendientes = totalDocumentos - documentosAprobados - documentosEnRevision - documentosObservados;

  return {
    totalDocumentos,
    documentosAprobados,
    documentosEnRevision,
    documentosPendientes,
    documentosObservados,
  };
};

const getCurrentLevel = (expediente, metrics) => {
  if (expediente?.estadoProceso === "aprobado") {
    return "Certificacion otorgada";
  }
  if (metrics.documentosAprobados > 0 || metrics.documentosEnRevision > 0) {
    return "Evaluacion";
  }
  return "Pre-certificacion";
};

const getAverageReviewDays = (expediente) => {
  const documents = expediente?.documentos || {};
  const dayValues = documentDefinitions
    .map(({ key }) => {
      const uploadedAt = toSafeDate(documents[key]?.uploadedAt);
      if (!uploadedAt) {
        return null;
      }
      const diffMs = Date.now() - uploadedAt.getTime();
      return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    })
    .filter((value) => value !== null);

  if (!dayValues.length) {
    return 0;
  }

  const total = dayValues.reduce((sum, value) => sum + value, 0);
  return Number((total / dayValues.length).toFixed(1));
};

const buildTimelineSteps = (user, expediente, metrics) => {
  const hasCompanyData = Boolean(
    expediente?.companyData?.razonSocial ||
      expediente?.companyData?.nit ||
      expediente?.companyData?.tipoOperacion?.length
  );
  const hasUploads = metrics.totalDocumentos > metrics.documentosPendientes;
  const hasObservation = metrics.documentosObservados > 0;
  const inReview = metrics.documentosEnRevision > 0 || metrics.documentosAprobados > 0;
  const allDocumentsReady = metrics.documentosPendientes === 0;

  return [
    {
      key: "registro",
      title: "Registro",
      icon: "fa-user-check",
      status: user?.isActivated || hasCompanyData ? "completado" : "pendiente",
      description: hasCompanyData
        ? "La informacion inicial del cliente ya fue registrada."
        : "Completa el registro y activa el acceso para iniciar el proceso.",
    },
    {
      key: "documentacion",
      title: "Documentacion",
      icon: "fa-folder-open",
      status: allDocumentsReady ? "completado" : hasUploads ? "en_proceso" : "pendiente",
      description: `${metrics.totalDocumentos - metrics.documentosPendientes}/${metrics.totalDocumentos} documentos cargados.`,
    },
    {
      key: "evaluacion",
      title: "Evaluacion tecnica",
      icon: "fa-magnifying-glass-chart",
      status: expediente?.estadoProceso === "aprobado" ? "completado" : inReview ? "en_proceso" : "pendiente",
      description:
        metrics.documentosAprobados > 0
          ? `${metrics.documentosAprobados} documentos aprobados por revision tecnica.`
          : "Aun no hay validaciones tecnicas registradas.",
    },
    {
      key: "observaciones",
      title: "Observaciones",
      icon: "fa-circle-exclamation",
      status: hasObservation ? "observacion" : inReview ? "completado" : "pendiente",
      description: hasObservation
        ? `${metrics.documentosObservados} documentos requieren ajustes.`
        : "No hay observaciones activas para el expediente.",
    },
    {
      key: "certificacion",
      title: "Certificacion",
      icon: "fa-certificate",
      status:
        expediente?.estadoProceso === "aprobado"
          ? "completado"
          : inReview || hasUploads
            ? "en_proceso"
            : "pendiente",
      description:
        expediente?.estadoProceso === "aprobado"
          ? "La certificacion ya fue otorgada."
          : "El expediente continua su flujo hacia la certificacion.",
    },
  ];
};

const buildRecentActivity = (user, expediente) => {
  const activities = [];
  const documents = expediente?.documentos || {};

  if (user?.activatedAt) {
    activities.push({
      type: "codigo_activado",
      icon: "fa-key",
      title: "Codigo activado",
      description: "El acceso completo del cliente fue habilitado.",
      status: "completado",
      date: user.activatedAt,
    });
  }

  documentDefinitions.forEach(({ key, label }) => {
    const uploadedAt = toSafeDate(documents[key]?.uploadedAt);
    const status = documents[key]?.status || "pendiente";

    if (uploadedAt) {
      activities.push({
        type: "documento_cargado",
        icon: "fa-file-arrow-up",
        title: "Documento cargado",
        description: `${label} fue cargado al expediente.`,
        status: "en_proceso",
        date: uploadedAt,
      });
    }

    if (status === "aprobado") {
      activities.push({
        type: "documento_aprobado",
        icon: "fa-circle-check",
        title: "Documento aprobado",
        description: `${label} aparece aprobado en el expediente.`,
        status: "completado",
        date: expediente?.updatedAt || uploadedAt || expediente?.createdAt || new Date(),
      });
    }

    if (status === "rechazado") {
      activities.push({
        type: "observacion_generada",
        icon: "fa-triangle-exclamation",
        title: "Observacion generada",
        description: `${label} requiere ajustes antes de continuar.`,
        status: "observacion",
        date: expediente?.updatedAt || uploadedAt || expediente?.createdAt || new Date(),
      });
    }
  });

  return activities
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);
};

const getDashboardStats = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const [user, expediente] = await Promise.all([
      User.findById(userId).lean(),
      CertificationExpediente.findOne({ userId }).lean(),
    ]);
    const metrics = getExpedienteMetrics(expediente);
    const scoreCumplimiento = metrics.totalDocumentos
      ? Math.round((metrics.documentosAprobados / metrics.totalDocumentos) * 100)
      : 0;

    return res.json({
      ...metrics,
      scoreCumplimiento,
      tiempoPromedioRevisionDias: getAverageReviewDays(expediente),
      nivelActualProceso: getCurrentLevel(expediente, metrics),
      percentCompletado: metrics.totalDocumentos
        ? Math.round((metrics.documentosAprobados / metrics.totalDocumentos) * 100)
        : 0,
      percentEnRevision: metrics.totalDocumentos
        ? Math.round((metrics.documentosEnRevision / metrics.totalDocumentos) * 100)
        : 0,
      percentPendiente: metrics.totalDocumentos
        ? Math.round(((metrics.documentosPendientes + metrics.documentosObservados) / metrics.totalDocumentos) * 100)
        : 0,
      timeline: buildTimelineSteps(user, expediente, metrics),
      generatedAt: new Date(),
    });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible cargar las metricas del dashboard",
      details: error.message,
    });
  }
};

const getRecentActivity = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const [user, expediente] = await Promise.all([
      User.findById(userId).lean(),
      CertificationExpediente.findOne({ userId }).lean(),
    ]);

    return res.json({
      items: buildRecentActivity(user, expediente),
    });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible cargar la actividad reciente",
      details: error.message,
    });
  }
};

const getTimelineStatus = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const [user, expediente] = await Promise.all([
      User.findById(userId).lean(),
      CertificationExpediente.findOne({ userId }).lean(),
    ]);
    const metrics = getExpedienteMetrics(expediente);

    return res.json({
      steps: buildTimelineSteps(user, expediente, metrics),
    });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible cargar la linea de tiempo",
      details: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getRecentActivity,
  getTimelineStatus,
};
