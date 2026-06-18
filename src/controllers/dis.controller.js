const DIS = require("../models/DIS.model");
const User = require("../models/User");
const CertificationExpediente = require("../models/CertificationExpediente");
const { generateDisDocxBuffer } = require("../services/dis.service");
const { DIS_FILENAME } = require("../services/expedienteDocs.service");

const managementRoles = [
  "Ejecutivo responsable",
  "Jefe de pilotos",
  "Gerente Seguridad Operacional - SMS",
  "Responsable gestion mantenimiento",
];

const requestTypes = [
  "Certificacion inicial",
  "Modificacion permiso",
  "Adicion permiso",
];

const contactTypes = ["VLOS", "EVLOS", "BVLOS"];
const possessionTypes = ["Propia", "Arriendo"];

const buildDefaultManagementTeam = () =>
  managementRoles.map((cargo) => ({
    cargo,
    nombre: "",
    correoElectronico: "",
    telefono: "",
  }));

const buildEmptyDis = (clientId) => ({
  clientId,
  sectionA: {
    nombreSolicitanteOrganizacion: "",
    nit: "",
    direccionOficinaAdministrativa: "",
    departamento: "",
    ciudad: "",
    lugarInspeccionOperacional: "",
    departamentoInspeccion: "",
    ciudadInspeccion: "",
  },
  sectionB: {
    personalGestion: buildDefaultManagementTeam(),
  },
  sectionC: {
    normativaRAC100: true,
    tipoSolicitud: "Certificacion inicial",
    serviciosComerciales: false,
    tiposOperacion: [],
    otroTipoOperacion: "",
    tipoContactoVisual: "",
    vuelosEspeciales: [],
    otroVueloEspecial: "",
  },
  sectionD: {
    uas: [],
  },
  sectionE: {
    eta: [],
  },
  sectionF: {
    informacionAdicional: "",
    fechaReunionOrientacion: null,
  },
  sectionG: {
    nombreDeclarante: "",
    cargo: "",
    fecha: null,
    firma: "",
  },
  estado: "borrador",
  documentGeneration: {
    status: "pending",
    lastGeneratedAt: null,
    format: "",
    documentKey: "",
    documentUrl: "",
  },
});

const normalizeString = (value) => String(value || "").trim();

const normalizeDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "INVALID_DATE" : date;
};

const normalizeManagementTeam = (items) => {
  if (!Array.isArray(items)) {
    return buildDefaultManagementTeam();
  }

  const byRole = new Map();
  for (const role of managementRoles) {
    byRole.set(role, {
      cargo: role,
      nombre: "",
      correoElectronico: "",
      telefono: "",
    });
  }

  for (const item of items) {
    const cargo = normalizeString(item?.cargo);
    if (!managementRoles.includes(cargo)) {
      continue;
    }

    byRole.set(cargo, {
      cargo,
      nombre: normalizeString(item?.nombre),
      correoElectronico: normalizeString(item?.correoElectronico).toLowerCase(),
      telefono: normalizeString(item?.telefono),
    });
  }

  return managementRoles.map((role) => byRole.get(role));
};

const hasAnyFilledValue = (values) =>
  values.some((value) => {
    if (typeof value === "number") {
      return value > 0;
    }

    return Boolean(normalizeString(value));
  });

const normalizeUasItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      marca: normalizeString(item?.marca),
      modelo: normalizeString(item?.modelo),
      cantidad: Number(item?.cantidad) > 0 ? Number(item.cantidad) : 0,
      pbmo: normalizeString(item?.pbmo),
      posesion: possessionTypes.includes(normalizeString(item?.posesion))
        ? normalizeString(item?.posesion)
        : "",
      tipoOperacion: normalizeString(item?.tipoOperacion),
      numeroRegistroRUAS: normalizeString(item?.numeroRegistroRUAS),
    }))
    .filter((item) =>
      hasAnyFilledValue([
        item.marca,
        item.modelo,
        item.cantidad,
        item.pbmo,
        item.tipoOperacion,
        item.numeroRegistroRUAS,
      ])
    );
};

const normalizeEtaItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      marca: normalizeString(item?.marca),
      modelo: normalizeString(item?.modelo),
      cantidad: Number(item?.cantidad) > 0 ? Number(item.cantidad) : 0,
      posesion: possessionTypes.includes(normalizeString(item?.posesion))
        ? normalizeString(item?.posesion)
        : "",
      tipoOperacion: normalizeString(item?.tipoOperacion),
      numeroRegistroRETA: normalizeString(item?.numeroRegistroRETA),
    }))
    .filter((item) =>
      hasAnyFilledValue([
        item.marca,
        item.modelo,
        item.cantidad,
        item.tipoOperacion,
        item.numeroRegistroRETA,
      ])
    );
};

const normalizeDisPayload = (payload, clientId) => {
  const fechaReunionOrientacion = normalizeDate(payload?.sectionF?.fechaReunionOrientacion);
  const fechaDeclaracion = normalizeDate(payload?.sectionG?.fecha);

  if (fechaReunionOrientacion === "INVALID_DATE" || fechaDeclaracion === "INVALID_DATE") {
    return { error: "Una o varias fechas son invalidas." };
  }

  const tipoSolicitud = normalizeString(payload?.sectionC?.tipoSolicitud);
  const tipoContactoVisual = normalizeString(payload?.sectionC?.tipoContactoVisual);
  const estado = normalizeString(payload?.estado) || "borrador";

  return {
    data: {
      clientId,
      sectionA: {
        nombreSolicitanteOrganizacion: normalizeString(
          payload?.sectionA?.nombreSolicitanteOrganizacion
        ),
        nit: normalizeString(payload?.sectionA?.nit),
        direccionOficinaAdministrativa: normalizeString(
          payload?.sectionA?.direccionOficinaAdministrativa
        ),
        departamento: normalizeString(payload?.sectionA?.departamento),
        ciudad: normalizeString(payload?.sectionA?.ciudad),
        lugarInspeccionOperacional: normalizeString(
          payload?.sectionA?.lugarInspeccionOperacional
        ),
        departamentoInspeccion: normalizeString(payload?.sectionA?.departamentoInspeccion),
        ciudadInspeccion: normalizeString(payload?.sectionA?.ciudadInspeccion),
      },
      sectionB: {
        personalGestion: normalizeManagementTeam(payload?.sectionB?.personalGestion),
      },
      sectionC: {
        normativaRAC100: Boolean(payload?.sectionC?.normativaRAC100),
        tipoSolicitud: requestTypes.includes(tipoSolicitud)
          ? tipoSolicitud
          : "Certificacion inicial",
        serviciosComerciales: Boolean(payload?.sectionC?.serviciosComerciales),
        tiposOperacion: Array.isArray(payload?.sectionC?.tiposOperacion)
          ? payload.sectionC.tiposOperacion
              .map((item) => normalizeString(item))
              .filter(Boolean)
          : [],
        otroTipoOperacion: normalizeString(payload?.sectionC?.otroTipoOperacion),
        tipoContactoVisual: contactTypes.includes(tipoContactoVisual) ? tipoContactoVisual : "",
        vuelosEspeciales: Array.isArray(payload?.sectionC?.vuelosEspeciales)
          ? payload.sectionC.vuelosEspeciales
              .map((item) => normalizeString(item))
              .filter(Boolean)
          : [],
        otroVueloEspecial: normalizeString(payload?.sectionC?.otroVueloEspecial),
      },
      sectionD: {
        uas: normalizeUasItems(payload?.sectionD?.uas),
      },
      sectionE: {
        eta: normalizeEtaItems(payload?.sectionE?.eta),
      },
      sectionF: {
        informacionAdicional: normalizeString(payload?.sectionF?.informacionAdicional),
        fechaReunionOrientacion,
      },
      sectionG: {
        nombreDeclarante: normalizeString(payload?.sectionG?.nombreDeclarante),
        cargo: normalizeString(payload?.sectionG?.cargo),
        fecha: fechaDeclaracion,
        firma: normalizeString(payload?.sectionG?.firma),
      },
      estado: estado === "enviado" ? "enviado" : "borrador",
    },
  };
};

const serializeDis = (dis) => {
  const source = typeof dis.toObject === "function" ? dis.toObject() : dis;
  const base = buildEmptyDis(source.clientId);

  return {
    _id: source._id,
    clientId: String(source.clientId),
    sectionA: {
      ...base.sectionA,
      ...(source.sectionA || {}),
    },
    sectionB: {
      personalGestion:
        source.sectionB?.personalGestion?.length
          ? source.sectionB.personalGestion
          : base.sectionB.personalGestion,
    },
    sectionC: {
      ...base.sectionC,
      ...(source.sectionC || {}),
    },
    sectionD: {
      uas: Array.isArray(source.sectionD?.uas) ? source.sectionD.uas : [],
    },
    sectionE: {
      eta: Array.isArray(source.sectionE?.eta) ? source.sectionE.eta : [],
    },
    sectionF: {
      ...base.sectionF,
      ...(source.sectionF || {}),
    },
    sectionG: {
      ...base.sectionG,
      ...(source.sectionG || {}),
    },
    estado: source.estado || "borrador",
    documentGeneration: {
      ...base.documentGeneration,
      ...(source.documentGeneration || {}),
    },
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

const getUserId = (req) => req.user?._id?.toString() || req.user?.id || "";

const ensureClientAccess = (req, clientId) => {
  if (req.user?.rol === "admin") {
    return true;
  }

  return req.user?.rol === "cliente" && getUserId(req) === String(clientId);
};

const createDis = async (req, res) => {
  try {
    const clientId = getUserId(req);
    const normalized = normalizeDisPayload(req.body || {}, clientId);

    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    let dis = await DIS.findOne({ clientId });
    if (!dis) {
      dis = await DIS.create(normalized.data);
    } else {
      dis.set(normalized.data);
      await dis.save();
    }

    return res.status(201).json({
      message: "DIS guardada correctamente.",
      dis: serializeDis(dis),
    });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible guardar la DIS.",
      details: error.message,
    });
  }
};

const getDisByClientId = async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!ensureClientAccess(req, clientId)) {
      return res.status(403).json({ message: "No autorizado para este recurso" });
    }

    let dis = await DIS.findOne({ clientId });
    if (!dis && req.user?.rol === "cliente" && getUserId(req) === String(clientId)) {
      dis = await DIS.create(buildEmptyDis(clientId));
    }

    if (!dis) {
      return res.status(404).json({ message: "DIS no encontrada." });
    }

    return res.json({ dis: serializeDis(dis) });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible cargar la DIS.",
      details: error.message,
    });
  }
};

const updateDis = async (req, res) => {
  try {
    const { id } = req.params;
    const dis = await DIS.findById(id);

    if (!dis) {
      return res.status(404).json({ message: "DIS no encontrada." });
    }

    if (req.user?.rol !== "cliente" || getUserId(req) !== String(dis.clientId)) {
      return res.status(403).json({ message: "No autorizado para editar esta DIS" });
    }

    const normalized = normalizeDisPayload(req.body || {}, String(dis.clientId));
    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    dis.set({
      ...normalized.data,
      documentGeneration: dis.documentGeneration,
    });
    await dis.save();

    return res.json({
      message: "DIS actualizada correctamente.",
      dis: serializeDis(dis),
    });
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible actualizar la DIS.",
      details: error.message,
    });
  }
};

const generateDisDocument = async (req, res) => {
  try {
    const clienteId = String(req.body?.clienteId || "").trim();

    if (!clienteId) {
      return res.status(400).json({ message: "clienteId es obligatorio." });
    }

    const [client, expedienteDoc, disDoc] = await Promise.all([
      User.findById(clienteId).lean(),
      CertificationExpediente.findOne({ userId: clienteId }).lean(),
      DIS.findOne({ clientId: clienteId }),
    ]);

    if (!client || client.rol !== "cliente") {
      return res.status(404).json({ message: "Cliente no encontrado." });
    }

    if (!client.isActivated) {
      return res.status(403).json({
        message: "Cliente no activado. No se puede generar DIS.",
      });
    }

    const dis = disDoc ? serializeDis(disDoc) : null;
    if (!dis) {
      return res.status(400).json({
        message: "Faltan datos para generar la DIS.",
        missingFields: ["dis"],
      });
    }

    try {
      const buffer = generateDisDocxBuffer({
        client,
        expediente: expedienteDoc,
        dis,
      });

      await DIS.updateOne(
        { _id: disDoc._id },
        {
          $set: {
            "documentGeneration.status": "generated",
            "documentGeneration.lastGeneratedAt": new Date(),
            "documentGeneration.format": "docx",
          },
        }
      );

      const fileName = DIS_FILENAME;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(buffer);
    } catch (error) {
      if (error.code === "MISSING_FIELDS") {
        return res.status(400).json({
          message: "Faltan datos para generar la DIS.",
          missingFields: error.fields || [],
        });
      }

      if (error.code === "TEMPLATE_WITHOUT_PLACEHOLDERS") {
        return res.status(400).json({
          message: "Plantilla sin placeholders.",
        });
      }

      return res.status(500).json({
        message: "Error plantilla.",
        details: error.message,
      });
    }
  } catch (error) {
    return res.status(500).json({
      message: "No fue posible generar el documento DIS.",
      details: error.message,
    });
  }
};

module.exports = {
  buildEmptyDis,
  normalizeDisPayload,
  serializeDis,
  createDis,
  getDisByClientId,
  updateDis,
  generateDisDocument,
};
