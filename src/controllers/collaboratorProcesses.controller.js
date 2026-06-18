const CertificationExpediente = require("../models/CertificationExpediente");
const CertificationProcess = require("../models/CertificationProcess");
const DIS = require("../models/DIS.model");
const User = require("../models/User");
const { getSignedUrl } = require("../services/r2.service");
const {
  buildEmptyDis,
  normalizeDisPayload,
  serializeDis,
} = require("./dis.controller");

const REQUIRED_DOCUMENTS = [
  { key: "camara_comercio", nombre: "Certificado Camara de Comercio", expedienteKey: "camaraComercio" },
  { key: "ruas", nombre: "Registro UAS (RUAS)", expedienteKey: "ruas" },
  { key: "reta", nombre: "Registro ETA (RETA)", expedienteKey: "reta" },
  { key: "cronograma_certificacion", nombre: "Cronograma certificacion", expedienteKey: null },
  { key: "hv_jefe_pilotos", nombre: "Hoja de Vida Jefe de Pilotos", expedienteKey: "hojaVidaJefePilotos" },
  { key: "hv_gerente_sms", nombre: "Hoja de Vida Gerente Seguridad Operacional", expedienteKey: "hojaVidaGerenteSeguridad" },
];

const DIS_COMPLETION_BONUS = 10;

const getClientBaseStatus = (documents, disCompleted) => {
  if (documents.every((item) => item.estado === "aprobado") && disCompleted) {
    return "Finalizado";
  }
  if (documents.some((item) => item.estado === "rechazado" || item.observacion)) {
    return "Con observaciones";
  }
  if (documents.some((item) => item.estado !== "pendiente") || disCompleted) {
    return "En proceso";
  }
  return "Activado";
};

const calculateProgress = (documents, disCompleted) => {
  const totalDocs = documents.length || 1;
  const approvedDocs = documents.filter((item) => item.estado === "aprobado").length;
  const basePercent = Math.round((approvedDocs / totalDocs) * 90);
  return Math.min(100, basePercent + (disCompleted ? DIS_COMPLETION_BONUS : 0));
};

const isDisCompleted = (dis) => {
  if (!dis) {
    return false;
  }

  return (
    dis.estado === "enviado" ||
    Boolean(
      dis.sectionA?.nombreSolicitanteOrganizacion &&
        dis.sectionC?.tiposOperacion?.length &&
        dis.sectionD?.uas?.length &&
        dis.sectionE?.eta?.length &&
        dis.sectionG?.nombreDeclarante
    )
  );
};

const mapExpedienteDocument = async (processDocument, expedienteDocument) => {
  const key = expedienteDocument?.key || processDocument?.archivoKey || "";
  const archivoUrl = key ? await getSignedUrl(key) : processDocument?.archivoUrl || "";

  return {
    key: processDocument.key,
    nombre: processDocument.nombre,
    estado: expedienteDocument?.status || processDocument?.estado || "pendiente",
    archivoKey: key,
    archivoUrl,
    observacion: processDocument?.observacion || "",
    updatedAt:
      expedienteDocument?.uploadedAt ||
      processDocument?.updatedAt ||
      null,
  };
};

const buildProcessTimeline = (process, expediente, disCompleted) => {
  const documents = process.documentos || [];
  const hasCompanyData = Boolean(
    expediente?.companyData?.razonSocial ||
      expediente?.companyData?.nit ||
      expediente?.companyData?.tipoOperacion?.length
  );
  const hasUploadedDocs = documents.some((item) => item.estado !== "pendiente");
  const hasApprovedDocs = documents.some((item) => item.estado === "aprobado");
  const hasObservations = documents.some((item) => item.estado === "rechazado" || item.observacion);

  return [
    {
      key: "registro",
      title: "Registro y activacion",
      status: hasCompanyData ? "completado" : "pendiente",
    },
    {
      key: "expediente",
      title: "Datos empresa",
      status: hasCompanyData ? "completado" : "pendiente",
    },
    {
      key: "dis",
      title: "DIS diligenciada",
      status: disCompleted ? "completado" : "pendiente",
    },
    {
      key: "documentos",
      title: "Documentos cargados",
      status: hasUploadedDocs ? "en_proceso" : "pendiente",
    },
    {
      key: "revision",
      title: "Revision y observaciones",
      status: hasObservations ? "observacion" : hasApprovedDocs ? "en_proceso" : "pendiente",
    },
    {
      key: "final",
      title: "Aprobacion final",
      status: process.estadoGeneral === "Finalizado" ? "completado" : "pendiente",
    },
  ];
};

const serializeObservation = (item) => ({
  mensaje: item.mensaje,
  createdAt: item.createdAt,
  createdBy: item.createdBy,
  createdByName: item.createdByName,
  tipo: item.tipo,
});

const serializeProcess = (process, client, expediente, dis) => {
  const documents = process.documentos || [];
  const disCompleted = isDisCompleted(dis);
  const approvedCount = documents.filter((item) => item.estado === "aprobado").length;
  const pendingCount = documents.filter((item) => item.estado === "pendiente").length;
  const activeObservations = documents.filter(
    (item) => item.estado === "rechazado" || item.observacion
  ).length;

  return {
    ok: true,
    data: {
      client: {
        _id: client._id,
        nombre: client.nombre,
        email: client.email,
        isActivated: client.isActivated,
        activatedAt: client.activatedAt,
      },
      company: {
        razonSocial: expediente?.companyData?.razonSocial || client.nombre,
        tipoOperacion: expediente?.companyData?.tipoOperacion || [],
        nit: expediente?.companyData?.nit || "",
      },
      process: {
        _id: process._id,
        clientId: process.clientId,
        estadoGeneral: process.estadoGeneral,
        porcentajeAvance: process.porcentajeAvance,
        documentos: documents,
        dis: dis,
        observaciones: (process.observaciones || [])
          .map(serializeObservation)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        updatedAt: process.updatedAt,
      },
      kpis: {
        documentosCargados: documents.filter((item) => item.estado !== "pendiente").length,
        documentosPendientes: pendingCount,
        observacionesActivas: activeObservations,
        porcentajeAvance: process.porcentajeAvance,
        disCompletado: disCompleted,
        documentosAprobados: approvedCount,
      },
      timeline: buildProcessTimeline(process, expediente, disCompleted),
    },
  };
};

const ensureProcessForClient = async (clientId) => {
  const [client, expediente, disDoc, existingProcess] = await Promise.all([
    User.findById(clientId).lean(),
    CertificationExpediente.findOne({ userId: clientId }),
    DIS.findOne({ clientId }),
    CertificationProcess.findOne({ clientId }),
  ]);

  if (!client || client.rol !== "cliente" || !client.isActivated) {
    return null;
  }

  const dis = disDoc ? serializeDis(disDoc) : serializeDis(buildEmptyDis(clientId));
  const process = existingProcess || new CertificationProcess({ clientId });
  const currentDocuments = new Map((process.documentos || []).map((item) => [item.key, item]));

  const syncedDocuments = [];
  for (const definition of REQUIRED_DOCUMENTS) {
    const current = currentDocuments.get(definition.key) || {
      key: definition.key,
      nombre: definition.nombre,
      estado: "pendiente",
      archivoKey: "",
      archivoUrl: "",
      observacion: "",
      updatedAt: null,
    };

    const expedienteDocument = definition.expedienteKey
      ? expediente?.documentos?.[definition.expedienteKey]
      : null;

    const mapped = expedienteDocument
      ? await mapExpedienteDocument(current, expedienteDocument)
      : {
          ...current,
          nombre: definition.nombre,
        };

    syncedDocuments.push(mapped);
  }

  process.documentos = syncedDocuments;
  process.dis = dis;
  process.estadoGeneral = getClientBaseStatus(syncedDocuments, isDisCompleted(dis));
  process.porcentajeAvance = calculateProgress(syncedDocuments, isDisCompleted(dis));
  await process.save();

  return { client, expediente, dis, process };
};

const getActiveProcesses = async (_req, res) => {
  try {
    const clients = await User.find({ rol: "cliente", isActivated: true })
      .sort({ activatedAt: -1, updatedAt: -1 })
      .lean();

    const results = [];
    for (const client of clients) {
      const synced = await ensureProcessForClient(client._id);
      if (!synced) {
        continue;
      }

      results.push({
        clientId: String(client._id),
        empresa: synced.expediente?.companyData?.razonSocial || client.nombre,
        nit: synced.expediente?.companyData?.nit || "",
        estado: synced.process.estadoGeneral,
        porcentajeAvance: synced.process.porcentajeAvance,
        fechaRegistro:
          synced.expediente?.companyData?.fechaRegistro ||
          client.activatedAt ||
          client.createdAt,
      });
    }

    return res.json({ ok: true, data: results });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible cargar los procesos activos.",
      details: error.message,
    });
  }
};

const getProcessDetail = async (req, res) => {
  try {
    const synced = await ensureProcessForClient(req.params.clientId);
    if (!synced) {
      return res.status(404).json({ ok: false, message: "Proceso no encontrado." });
    }

    return res.json(serializeProcess(synced.process, synced.client, synced.expediente, synced.dis));
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible cargar el detalle del proceso.",
      details: error.message,
    });
  }
};

const updateProcessStatus = async (req, res) => {
  try {
    const synced = await ensureProcessForClient(req.params.clientId);
    if (!synced) {
      return res.status(404).json({ ok: false, message: "Proceso no encontrado." });
    }

    const estadoGeneral = String(req.body?.estadoGeneral || "").trim();
    const porcentajeAvance = Number(req.body?.porcentajeAvance);

    if (estadoGeneral) {
      synced.process.estadoGeneral = estadoGeneral;
    }
    if (!Number.isNaN(porcentajeAvance)) {
      synced.process.porcentajeAvance = Math.max(0, Math.min(100, porcentajeAvance));
    }

    synced.process.observaciones.unshift({
      mensaje: "Estado general del proceso actualizado.",
      createdAt: new Date(),
      createdBy: req.user._id,
      createdByName: req.user.nombre,
      tipo: "estado",
    });
    await synced.process.save();

    return res.json(serializeProcess(synced.process, synced.client, synced.expediente, synced.dis));
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible actualizar el estado del proceso.",
      details: error.message,
    });
  }
};

const updateProcessDocument = async (req, res) => {
  try {
    const synced = await ensureProcessForClient(req.params.clientId);
    if (!synced) {
      return res.status(404).json({ ok: false, message: "Proceso no encontrado." });
    }

    const key = String(req.body?.key || "").trim();
    const estado = String(req.body?.estado || "").trim();
    const observacion = String(req.body?.observacion || "").trim();

    const target = synced.process.documentos.find((item) => item.key === key);
    if (!target) {
      return res.status(400).json({ ok: false, message: "Documento no valido." });
    }

    if (!["pendiente", "cargado", "aprobado", "rechazado"].includes(estado)) {
      return res.status(400).json({ ok: false, message: "Estado de documento no valido." });
    }

    target.estado = estado;
    target.observacion = observacion;
    target.updatedAt = new Date();

    const definition = REQUIRED_DOCUMENTS.find((item) => item.key === key);
    if (definition?.expedienteKey && synced.expediente?.documentos?.[definition.expedienteKey]) {
      synced.expediente.documentos[definition.expedienteKey].status = estado;
      await synced.expediente.save();
    }

    synced.process.estadoGeneral = getClientBaseStatus(
      synced.process.documentos,
      isDisCompleted(synced.dis)
    );
    synced.process.porcentajeAvance = calculateProgress(
      synced.process.documentos,
      isDisCompleted(synced.dis)
    );
    synced.process.observaciones.unshift({
      mensaje: `${target.nombre} fue marcado como ${estado}${observacion ? `: ${observacion}` : "."}`,
      createdAt: new Date(),
      createdBy: req.user._id,
      createdByName: req.user.nombre,
      tipo: estado === "rechazado" ? "observacion" : "documento",
    });
    await synced.process.save();

    const refreshed = await ensureProcessForClient(req.params.clientId);
    return res.json(
      serializeProcess(refreshed.process, refreshed.client, refreshed.expediente, refreshed.dis)
    );
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible actualizar el documento.",
      details: error.message,
    });
  }
};

const updateProcessDis = async (req, res) => {
  try {
    const synced = await ensureProcessForClient(req.params.clientId);
    if (!synced) {
      return res.status(404).json({ ok: false, message: "Proceso no encontrado." });
    }

    const normalized = normalizeDisPayload(req.body || {}, req.params.clientId);
    if (normalized.error) {
      return res.status(400).json({ ok: false, message: normalized.error });
    }

    let disDoc = await DIS.findOne({ clientId: req.params.clientId });
    if (!disDoc) {
      disDoc = await DIS.create(normalized.data);
    } else {
      disDoc.set({
        ...normalized.data,
        documentGeneration: disDoc.documentGeneration,
      });
      await disDoc.save();
    }

    const serializedDis = serializeDis(disDoc);
    synced.process.dis = serializedDis;
    synced.process.estadoGeneral = getClientBaseStatus(
      synced.process.documentos,
      isDisCompleted(serializedDis)
    );
    synced.process.porcentajeAvance = calculateProgress(
      synced.process.documentos,
      isDisCompleted(serializedDis)
    );
    synced.process.observaciones.unshift({
      mensaje: "DIS actualizada por colaborador.",
      createdAt: new Date(),
      createdBy: req.user._id,
      createdByName: req.user.nombre,
      tipo: "dis",
    });
    await synced.process.save();

    const refreshed = await ensureProcessForClient(req.params.clientId);
    return res.json(
      serializeProcess(refreshed.process, refreshed.client, refreshed.expediente, refreshed.dis)
    );
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible actualizar la DIS.",
      details: error.message,
    });
  }
};

const createProcessObservation = async (req, res) => {
  try {
    const synced = await ensureProcessForClient(req.params.clientId);
    if (!synced) {
      return res.status(404).json({ ok: false, message: "Proceso no encontrado." });
    }

    const mensaje = String(req.body?.mensaje || "").trim();
    const tipo = String(req.body?.tipo || "nota").trim();

    if (!mensaje) {
      return res.status(400).json({ ok: false, message: "La observacion es obligatoria." });
    }

    synced.process.observaciones.unshift({
      mensaje,
      createdAt: new Date(),
      createdBy: req.user._id,
      createdByName: req.user.nombre,
      tipo,
    });
    if (tipo === "observacion") {
      synced.process.estadoGeneral = "Con observaciones";
    }
    await synced.process.save();

    return res.json(serializeProcess(synced.process, synced.client, synced.expediente, synced.dis));
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible registrar la observacion.",
      details: error.message,
    });
  }
};

module.exports = {
  getActiveProcesses,
  getProcessDetail,
  updateProcessStatus,
  updateProcessDocument,
  updateProcessDis,
  createProcessObservation,
};
