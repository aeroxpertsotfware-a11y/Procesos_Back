const ManualGenerationJob = require("../models/ManualGenerationJob");
const { loadManualTemplate } = require("../utils/manualTemplates");
const geminiService = require("../services/gemini.service");
const {
  loadTemplateDocxBuffer,
  renderDocxWithData,
  assertDocxPlaceholders,
} = require("../services/docxTemplate.service");
const { loadManualReference } = require("../services/manualReference.service");
const { buildSmsValidationReport } = require("../services/manualValidation.service");
const { uploadBuffer, getSignedDownloadUrl } = require("../services/r2.service");
const CertificationExpediente = require("../models/CertificationExpediente");
const DIS = require("../models/DIS.model");
const User = require("../models/User");

const SMS_MANUAL_KEY = "sms";
const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const normalizePlaceholderKey = (placeholder = "") =>
  String(placeholder || "")
    .replace(/^\{\{/, "")
    .replace(/\}\}$/, "")
    .trim();

const buildJobFilename = (jobId) => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `sms_manual_${stamp}_${jobId}.docx`;
};

const appendLog = async (jobId, message) => {
  await ManualGenerationJob.findByIdAndUpdate(jobId, {
    $push: {
      logs: {
        at: new Date(),
        message,
      },
    },
  }).catch(() => null);
};

const updateJobState = async (jobId, payload, logMessage = "") => {
  await ManualGenerationJob.findByIdAndUpdate(jobId, payload).catch(() => null);
  if (logMessage) {
    await appendLog(jobId, logMessage);
  }
};

const buildStaticControlManualSection = (context = {}) => {
  const empresa = context.empresa || "[POR DEFINIR]";
  const documento = "SMS-MAN-001";
  const version = "Rev 01";
  const revisadoPor = context.gerenteSms || "Responsable del SMS";
  const aprobadoPor = context.ejecutivoResponsable || "Ejecutivo Responsable";

  return [
    "1.5.1 Objetivo",
    `Establecer el proceso formal para la actualizacion, aprobacion, control, distribucion y retiro de copias del manual SMS de ${empresa}, garantizando trazabilidad documental, integridad de la informacion y disponibilidad de la version vigente.`,
    "",
    "1.5.2 Alcance",
    `Aplica al documento ${documento}, a sus revisiones, a sus copias controladas y no controladas, y a toda distribucion interna o externa asociada al Sistema de Gestion de Seguridad Operacional del explotador UAS.`,
    "",
    "1.5.3 Responsables",
    `Ejecutivo Responsable: ${aprobadoPor}.`,
    `Gerente SMS o responsable documental: ${revisadoPor}.`,
    "Usuarios del manual: deben verificar el uso de la version vigente antes de aplicar cualquier procedimiento.",
    "",
    "1.5.4 Control de revisiones",
    `Toda modificacion del manual debe registrarse en el control de revisiones indicando version, descripcion del cambio, fecha de emision y responsable de aprobacion. La entrada en vigencia corresponde a la ultima version aprobada ${version}.`,
    "",
    "1.5.5 Distribucion y control de copias",
    "La distribucion controlada se realiza a los responsables definidos por la organizacion. Las copias obsoletas deben retirarse o marcarse como no vigentes. Las copias no controladas se usan solo como referencia y no reemplazan la version oficial aprobada.",
  ].join("\n");
};

const buildTemplateDataMap = ({ template, user, context = {} }) => {
  const now = new Date();
  const empresa = context.empresa || "[POR DEFINIR]";
  const nit = context.nit || "[POR DEFINIR]";
  const gerenteSms = context.gerenteSms || "Responsable del SMS";
  const ejecutivoResponsable = context.ejecutivoResponsable || "Ejecutivo Responsable";

  const dataMap = {
    FECHA: now.toLocaleDateString("es-CO"),
    EMPRESA: empresa,
    NIT: nit,
    ANO: String(now.getFullYear()),
    MANUAL_TITULO: "MANUAL DEL SISTEMA DE GESTION DE SEGURIDAD OPERACIONAL",
    MANUAL_SUBTITULO: "EXPLOTADOR DE SISTEMAS DE AERONAVES NO TRIPULADAS",
    REVISADO_POR: gerenteSms,
    APROBADO_POR: ejecutivoResponsable,
    REGISTRO_CAMBIOS_TEXTO:
      "Elaboracion original del manual SMS como parte del cumplimiento del proceso de certificacion del explotador UAS.",
    CONTROL_CAMBIOS_TEXTO: `Este manual esta sujeto a mejoras y revisiones de acuerdo con los cambios operacionales, organizacionales, documentales y regulatorios que ${empresa} y la autoridad aeronautica consideren necesarios para mantener vigente el Sistema de Gestion de Seguridad Operacional. Las casillas en blanco de las tablas asociadas permiten registrar futuras revisiones y correcciones.`,
    LPE_TEXTO:
      "La lista de paginas efectivas se consolida con la version final aprobada del manual. Hasta tanto no se cierre la edicion definitiva, la numeracion y fecha de cada capitulo deben validarse en la revision final del documento.",
  };

  for (const chapter of template.chapters || []) {
    const key = normalizePlaceholderKey(chapter.placeholder);
    if (key) {
      dataMap[key] = "";
    }
  }

  if (user?.nombre) {
    dataMap.SOLICITANTE = user.nombre;
  }

  dataMap.CAP_00 = buildStaticControlManualSection(context);

  return dataMap;
};

const buildContextFromClient = ({ client, expediente, dis }) => {
  const companyData = expediente?.companyData || {};
  const sectionA = dis?.sectionA || {};
  const sectionB = dis?.sectionB || {};
  const sectionC = dis?.sectionC || {};
  const sectionD = dis?.sectionD || {};
  const sectionE = dis?.sectionE || {};
  const firstManager = Array.isArray(sectionB.personalGestion) ? sectionB.personalGestion[0] : null;

  return {
    empresa:
      sectionA.nombreSolicitanteOrganizacion ||
      companyData.razonSocial ||
      client?.nombre ||
      "",
    nit: sectionA.nit || companyData.nit || "",
    nombreSolicitante:
      sectionA.nombreSolicitanteOrganizacion ||
      companyData.razonSocial ||
      client?.nombre ||
      "",
    emailEmpresa: companyData.emailEmpresa || client?.email || "",
    telefonoEmpresa: companyData.telefono || firstManager?.telefono || "",
    direccion: sectionA.direccionOficinaAdministrativa || companyData.direccion || "",
    ciudad: sectionA.ciudad || "",
    departamento: sectionA.departamento || "",
    lugarInspeccionOperacional: sectionA.lugarInspeccionOperacional || "",
    ciudadInspeccion: sectionA.ciudadInspeccion || "",
    departamentoInspeccion: sectionA.departamentoInspeccion || "",
    tipoOperacion:
      companyData.tipoOperacion?.length
        ? companyData.tipoOperacion.join(", ")
        : Array.isArray(sectionC.tiposOperacion)
          ? sectionC.tiposOperacion.join(", ")
          : "",
    actividadCIIU: Array.isArray(companyData.actividadCIIU) ? companyData.actividadCIIU.join(", ") : "",
    tipoSolicitud: sectionC.tipoSolicitud || "",
    contactoVisual: sectionC.tipoContactoVisual || "",
    serviciosComerciales:
      typeof sectionC.serviciosComerciales === "boolean"
        ? sectionC.serviciosComerciales
          ? "Si"
          : "No"
        : "",
    ejecutivoResponsable:
      Array.isArray(sectionB.personalGestion)
        ? sectionB.personalGestion.find((item) => item.cargo === "Ejecutivo responsable")?.nombre || ""
        : "",
    gerenteSms:
      Array.isArray(sectionB.personalGestion)
        ? sectionB.personalGestion.find((item) => item.cargo === "Gerente Seguridad Operacional - SMS")?.nombre || ""
        : "",
    jefePilotos:
      Array.isArray(sectionB.personalGestion)
        ? sectionB.personalGestion.find((item) => item.cargo === "Jefe de pilotos")?.nombre || ""
        : "",
    totalUas: Array.isArray(sectionD.uas) ? String(sectionD.uas.length) : "",
    totalEta: Array.isArray(sectionE.eta) ? String(sectionE.eta.length) : "",
  };
};

const getRequiredPlaceholderKeys = (template) =>
  (template?.chapters || [])
    .map((chapter) => normalizePlaceholderKey(chapter.placeholder || chapter.id))
    .filter(Boolean);

const getClientManualContext = async (clientId) => {
  const [client, expediente, dis] = await Promise.all([
    User.findById(clientId).lean(),
    CertificationExpediente.findOne({ userId: clientId }).lean(),
    DIS.findOne({ clientId }).lean(),
  ]);

  if (!client || client.rol !== "cliente" || !client.isActivated) {
    throw new Error("La empresa seleccionada no está activa o no existe.");
  }

  const companyData = expediente?.companyData || {};

  return {
    client,
    expediente,
    dis,
    context: buildContextFromClient({ client, expediente, dis }),
    targetClient: {
      clientId: client._id,
      nombre: client.nombre || "",
      empresa:
        companyData.razonSocial ||
        dis?.sectionA?.nombreSolicitanteOrganizacion ||
        client.nombre ||
        "",
      nit: companyData.nit || dis?.sectionA?.nit || "",
      tipoOperacion:
        Array.isArray(companyData.tipoOperacion) && companyData.tipoOperacion.length
          ? companyData.tipoOperacion
          : Array.isArray(dis?.sectionC?.tiposOperacion)
            ? dis.sectionC.tiposOperacion
            : [],
    },
  };
};

const buildPreviewText = (content = "", maxLength = 1600) => {
  const normalized = String(content || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
};

const buildDocumentPreview = (dataMap, chapters) => {
  return chapters
    .map((chapter) => {
      const key = normalizePlaceholderKey(chapter.placeholder || chapter.id);
      const content = String(dataMap[key] || "").trim();
      if (!content) {
        return "";
      }

      return `${chapter.title}\n\n${buildPreviewText(content, 1200)}`;
    })
    .filter(Boolean)
    .join("\n\n----------------------------------------\n\n");
};

const runSmsGenerationJob = async (jobId) => {
  try {
    const job = await ManualGenerationJob.findById(jobId).lean();
    if (!job) {
      return;
    }

    const template = loadManualTemplate(SMS_MANUAL_KEY);
    const templateBuffer = loadTemplateDocxBuffer();
    assertDocxPlaceholders(templateBuffer, getRequiredPlaceholderKeys(template));
    const chapters = Array.isArray(template.chapters) ? template.chapters : [];
    const totalChapters = chapters.length;
    const referenceText = loadManualReference(SMS_MANUAL_KEY);
    const context = job.targetClient?.clientId
      ? (await getClientManualContext(job.targetClient.clientId)).context
      : {
          empresa: "Organizacion solicitante",
          nit: "[POR DEFINIR]",
          nombreSolicitante: job.requestedBy?.nombre || "",
        };
    const dataMap = buildTemplateDataMap({
      template,
      user: { nombre: job.requestedBy?.nombre || "" },
      context,
    });

    await updateJobState(
      jobId,
      {
        status: "running",
        progress: 0,
        currentStep: "Preparando generacion del manual SMS",
        currentChapter: "",
        currentChapterTitle: "",
        completedChapters: 0,
        totalChapters,
        latestChapterPreview: "",
        documentPreview: "",
        errorMessage: "",
      },
      "Inicio de la generacion del manual SMS."
    );

    for (let index = 0; index < chapters.length; index += 1) {
      const chapter = chapters[index];
      const placeholderKey = normalizePlaceholderKey(chapter.placeholder || chapter.id);
      const stepLabel = `Generando ${placeholderKey || chapter.id || `CAP_${index + 1}`}`;

      if (placeholderKey === "CAP_00") {
        const progress = Math.round(((index + 1) / totalChapters) * 100);
        await updateJobState(
          jobId,
          {
            progress,
            currentStep: `Seccion completada: ${chapter.title}`,
            currentChapter: placeholderKey,
            currentChapterTitle: chapter.title,
            completedChapters: index + 1,
            latestChapterPreview: buildPreviewText(dataMap[placeholderKey], 2200),
            documentPreview: buildDocumentPreview(dataMap, chapters),
            chapters: chapters.map((item, itemIndex) => ({
              id: item.id,
              title: item.title,
              placeholder: normalizePlaceholderKey(item.placeholder || item.id),
              status: itemIndex <= index ? "done" : "pending",
              preview:
                itemIndex <= index
                  ? buildPreviewText(dataMap[normalizePlaceholderKey(item.placeholder || item.id)] || "", 360)
                  : "",
            })),
          },
          `Seccion fija completada: ${chapter.title}`
        );
        continue;
      }

      await updateJobState(
        jobId,
        {
          status: "running",
          currentStep: stepLabel,
          currentChapter: placeholderKey,
          currentChapterTitle: chapter.title,
          chapters: chapters.map((item, itemIndex) => ({
            id: item.id,
            title: item.title,
            placeholder: normalizePlaceholderKey(item.placeholder || item.id),
            status:
              itemIndex < index
                ? "done"
                : itemIndex === index
                  ? "running"
                  : "pending",
            preview:
              itemIndex < index
                ? buildPreviewText(dataMap[normalizePlaceholderKey(item.placeholder || item.id)] || "", 360)
                : "",
          })),
        },
        `Generando capitulo ${index + 1} de ${totalChapters}: ${chapter.title}`
      );

      const content = await geminiService.generateChapter({
        manualKey: SMS_MANUAL_KEY,
        chapter,
        context,
        globalInstructions: template.globalInstructions || [],
        referenceText,
      });

      dataMap[placeholderKey] = String(content || "").trim();

      const progress = Math.round(((index + 1) / totalChapters) * 100);
      await updateJobState(
        jobId,
        {
          progress,
          currentStep: `Capitulo completado: ${chapter.title}`,
          currentChapter: placeholderKey,
          currentChapterTitle: chapter.title,
          completedChapters: index + 1,
          latestChapterPreview: buildPreviewText(content, 2200),
          documentPreview: buildDocumentPreview(dataMap, chapters),
          chapters: chapters.map((item, itemIndex) => ({
            id: item.id,
            title: item.title,
            placeholder: normalizePlaceholderKey(item.placeholder || item.id),
            status: itemIndex <= index ? "done" : "pending",
            preview:
              itemIndex <= index
                ? buildPreviewText(dataMap[normalizePlaceholderKey(item.placeholder || item.id)] || "", 360)
                : "",
          })),
        },
        `Capitulo listo: ${chapter.title}`
      );
    }

    await updateJobState(
      jobId,
      {
        currentStep: "Renderizando documento Word",
        documentPreview: buildDocumentPreview(dataMap, chapters),
      },
      "Renderizando el documento final en formato Word."
    );

    const renderedDocx = renderDocxWithData(templateBuffer, dataMap);
    const validation = buildSmsValidationReport({ dataMap, template });
    const filename = buildJobFilename(jobId);
    const r2Key = `manuales/sms/${filename}`;

    await updateJobState(
      jobId,
      {
        currentStep: "Subiendo documento final a Cloudflare R2",
      },
      "Subiendo el documento final a Cloudflare R2."
    );

    await uploadBuffer(renderedDocx, r2Key, DOCX_MIME_TYPE);

    await updateJobState(
      jobId,
      {
        status: "done",
        progress: 100,
        currentStep: "Manual SMS generado correctamente",
        completedChapters: totalChapters,
        currentChapter: "",
        currentChapterTitle: "",
        documentPreview: buildDocumentPreview(dataMap, chapters),
        result: {
          r2Key,
          filename,
          mimeType: DOCX_MIME_TYPE,
          createdAt: new Date(),
        },
        validation,
      },
      `Manual SMS generado y almacenado correctamente. Validacion automatica: ${validation.score}%`
    );
  } catch (error) {
    await updateJobState(
      jobId,
      {
        status: "error",
        currentStep: "Error en la generacion",
        errorMessage: error.message || "No fue posible generar el manual SMS",
      },
      `Error durante la generacion: ${error.message || "Error desconocido"}`
    );
  }
};

const createManualGenerationJob = async (req, res) => {
  try {
    const manualKey = String(req.params.manualKey || "").trim().toLowerCase();
    const clientId = String(req.body?.clientId || "").trim();
    if (manualKey !== SMS_MANUAL_KEY) {
      return res.status(400).json({ message: "Por ahora solo se soporta el manual SMS." });
    }
    if (!clientId) {
      return res.status(400).json({ message: "Debes seleccionar una empresa activa." });
    }

    loadManualTemplate(SMS_MANUAL_KEY);
    const templateBuffer = loadTemplateDocxBuffer();
    const template = loadManualTemplate(SMS_MANUAL_KEY);
    assertDocxPlaceholders(templateBuffer, getRequiredPlaceholderKeys(template));
    const manualContext = await getClientManualContext(clientId);

    const job = await ManualGenerationJob.create({
      manualKey: SMS_MANUAL_KEY,
      requestedBy: {
        userId: req.user?._id || null,
        email: req.user?.email || "",
        nombre: req.user?.nombre || "",
      },
      targetClient: manualContext.targetClient,
      status: "pending",
      progress: 0,
      currentStep: "Job creado",
      currentChapter: "",
      currentChapterTitle: "",
      completedChapters: 0,
      totalChapters: Array.isArray(template.chapters) ? template.chapters.length : 0,
      latestChapterPreview: "",
      documentPreview: "",
      chapters: (template.chapters || []).map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        placeholder: normalizePlaceholderKey(chapter.placeholder || chapter.id),
        status: "pending",
        preview: "",
      })),
      logs: [
        {
          at: new Date(),
          message: `Job creado para la empresa ${manualContext.targetClient.empresa || manualContext.targetClient.nombre}.`,
        },
      ],
    });

    Promise.resolve()
      .then(() => runSmsGenerationJob(job._id))
      .catch(() => null);

    return res.status(202).json({ jobId: job._id.toString() });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible iniciar la generacion del manual SMS.",
      details: error.message,
    });
  }
};

const getManualGenerationJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await ManualGenerationJob.findById(jobId).lean();

    if (!job) {
      return res.status(404).json({ message: "Job no encontrado." });
    }

    const downloadUrl =
      job.status === "done" && job.result?.r2Key
        ? await getSignedDownloadUrl(job.result.r2Key, job.result.filename)
        : "";

    return res.json({
      jobId: job._id.toString(),
      manualKey: job.manualKey,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      targetClient: job.targetClient || null,
      currentChapter: job.currentChapter || "",
      currentChapterTitle: job.currentChapterTitle || "",
      completedChapters: job.completedChapters || 0,
      totalChapters: job.totalChapters || 0,
      latestChapterPreview: job.latestChapterPreview || "",
      documentPreview: job.documentPreview || "",
      chapters: job.chapters || [],
      logs: job.logs || [],
      result: job.result || null,
      validation: job.validation || null,
      errorMessage: job.errorMessage || "",
      downloadUrl,
      requestedBy: job.requestedBy || null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible consultar el job.",
      details: error.message,
    });
  }
};

const downloadManualGenerationJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await ManualGenerationJob.findById(jobId).lean();

    if (!job) {
      return res.status(404).json({ message: "Job no encontrado." });
    }

    if (job.status !== "done" || !job.result?.r2Key) {
      return res.status(400).json({ message: "El documento aun no esta disponible para descarga." });
    }

    const downloadUrl = await getSignedDownloadUrl(job.result.r2Key, job.result.filename);
    return res.redirect(downloadUrl);
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible descargar el documento.",
      details: error.message,
    });
  }
};

module.exports = {
  createManualGenerationJob,
  getManualGenerationJob,
  downloadManualGenerationJob,
};
