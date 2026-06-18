const User = require("../models/User");
const ActivationCode = require("../models/ActivationCode");
const ManualJob = require("../models/ManualJob");
const { generateUniqueActivationCode } = require("../utils/codeGenerator");

const getClientes = async (_req, res) => {
  try {
    const clientes = await User.find(
      { rol: "cliente" },
      { passwordHash: 0 }
    )
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ ok: true, clientes });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible listar clientes",
      details: error.message,
    });
  }
};

const createCodigoCliente = async (req, res) => {
  try {
    const { userId } = req.params;
    const note = String(req.body?.note || "").trim();

    const cliente = await User.findOne({ _id: userId, rol: "cliente" });
    if (!cliente) {
      return res.status(404).json({ ok: false, message: "Cliente no encontrado" });
    }

    const activeCode = await ActivationCode.findOne({
      userId: cliente._id,
      status: "active",
    });

    if (activeCode) {
      return res.status(409).json({
        ok: false,
        message: "El cliente ya tiene un codigo activo",
        code: activeCode.code,
      });
    }

    const code = await generateUniqueActivationCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const activationCode = await ActivationCode.create({
      code,
      userId: cliente._id,
      createdBy: req.user._id,
      status: "active",
      expiresAt,
      note,
    });

    cliente.activationCodeId = activationCode._id;
    await cliente.save();

    return res.status(201).json({
      ok: true,
      code: activationCode.code,
      status: activationCode.status,
      activationCodeId: activationCode._id.toString(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible crear codigo",
      details: error.message,
    });
  }
};

const revokeCodigo = async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    const activationCode = await ActivationCode.findOne({ code });
    if (!activationCode) {
      return res.status(404).json({ ok: false, message: "Codigo no encontrado" });
    }

    activationCode.status = "revoked";
    await activationCode.save();

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible revocar codigo",
      details: error.message,
    });
  }
};

const getCodigos = async (_req, res) => {
  try {
    const codigos = await ActivationCode.find()
      .populate("userId", "nombre email")
      .populate("createdBy", "nombre email")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ ok: true, codigos });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible listar codigos",
      details: error.message,
    });
  }
};

const getCodigosOverview = async (_req, res) => {
  try {
    const [total, active, used, revoked, list] = await Promise.all([
      ActivationCode.countDocuments(),
      ActivationCode.countDocuments({ status: "active" }),
      ActivationCode.countDocuments({ status: "used" }),
      ActivationCode.countDocuments({ status: "revoked" }),
      ActivationCode.find()
        .populate("userId", "nombre email")
        .populate("createdBy", "nombre email")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return res.json({
      ok: true,
      totals: { total, active, used, revoked },
      list: list.map((item) => ({
        _id: item._id,
        code: item.code,
        status: item.status,
        createdAt: item.createdAt,
        usedAt: item.usedAt || null,
        expiresAt: item.expiresAt || null,
        client: item.userId
          ? {
              name: item.userId.nombre,
              email: item.userId.email,
            }
          : null,
        createdBy: item.createdBy
          ? {
              name: item.createdBy.nombre,
              email: item.createdBy.email,
            }
          : null,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible cargar overview de codigos",
      details: error.message,
    });
  }
};

const deleteCodigo = async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    const activationCode = await ActivationCode.findOne({ code });
    if (!activationCode) {
      return res.status(404).json({ ok: false, message: "Codigo no encontrado" });
    }

    if (activationCode.status === "used") {
      return res.status(409).json({
        ok: false,
        message: "No es posible eliminar un codigo usado",
      });
    }

    await ActivationCode.deleteOne({ _id: activationCode._id });

    await User.updateMany(
      { activationCodeId: activationCode._id, isActivated: false },
      { $set: { activationCodeId: null } }
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible eliminar codigo",
      details: error.message,
    });
  }
};

const getMetricsOverview = async (req, res) => {
  try {
    const allowedRanges = new Set(["7d", "30d", "90d", "1y"]);
    const range = allowedRanges.has(String(req.query?.range || ""))
      ? String(req.query.range)
      : "30d";

    const rangeDays = range === "7d" ? 7 : range === "90d" ? 90 : range === "1y" ? 365 : 30;
    const sinceDate = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    const [clientsRegistered, clientsActivated, clientsPendingActivation, codesActive, codesUsed, codesRevoked] =
      await Promise.all([
        User.countDocuments({ rol: "cliente" }),
        User.countDocuments({ rol: "cliente", isActivated: true }),
        User.countDocuments({ rol: "cliente", isActivated: false }),
        ActivationCode.countDocuments({ status: "active" }),
        ActivationCode.countDocuments({ status: "used" }),
        ActivationCode.countDocuments({ status: "revoked" }),
      ]);

    const [notActivatedNoCode, codeAssigned] = await Promise.all([
      User.countDocuments({
        rol: "cliente",
        isActivated: false,
        $or: [{ activationCodeId: null }, { activationCodeId: { $exists: false } }],
      }),
      User.countDocuments({
        rol: "cliente",
        isActivated: false,
        activationCodeId: { $ne: null },
      }),
    ]);

    const activationsByMonthRaw = await User.aggregate([
      {
        $match: {
          rol: "cliente",
          isActivated: true,
          activatedAt: { $ne: null },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$activatedAt" },
            month: { $month: "$activatedAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const now = new Date();
    const monthsToInclude = range === "7d" ? 3 : range === "30d" ? 4 : range === "90d" ? 6 : 12;
    const monthLabels = [];
    for (let index = monthsToInclude - 1; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthLabels.push(key);
    }

    const monthCountMap = new Map();
    for (const item of activationsByMonthRaw) {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;
      monthCountMap.set(key, item.count);
    }

    const activationsByMonth = monthLabels.map((month) => ({
      month,
      count: monthCountMap.get(month) || 0,
    }));

    const manualsGenerated = await ManualJob.countDocuments({ status: "done" });

    const activationTimes = await User.aggregate([
      {
        $match: {
          rol: "cliente",
          isActivated: true,
          createdAt: { $ne: null },
          activatedAt: { $ne: null },
        },
      },
      {
        $project: {
          activationHours: {
            $divide: [{ $subtract: ["$activatedAt", "$createdAt"] }, 1000 * 60 * 60],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgHours: { $avg: "$activationHours" },
        },
      },
    ]);

    const avgActivationTimeHours = activationTimes.length
      ? Number(activationTimes[0].avgHours.toFixed(1))
      : 0;

    const topClients = await User.aggregate([
      { $match: { rol: "cliente" } },
      {
        $lookup: {
          from: "manualjobs",
          let: { clientId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$userId", "$$clientId"] }, { $eq: ["$status", "done"] }],
                },
              },
            },
          ],
          as: "manualJobs",
        },
      },
      {
        $project: {
          userId: "$_id",
          name: "$nombre",
          email: "$email",
          manualsGenerated: { $size: "$manualJobs" },
          status: { $cond: [{ $eq: ["$isActivated", true] }, "Activado", "Pendiente"] },
          createdAt: 1,
        },
      },
      { $sort: { manualsGenerated: -1, createdAt: -1 } },
      { $limit: 8 },
    ]);

    const [recentClients, recentCodesCreated, recentCodesUsed, recentCodesRevoked, recentUsersActivated] =
      await Promise.all([
        User.find({ rol: "cliente", createdAt: { $gte: sinceDate } })
          .sort({ createdAt: -1 })
          .limit(10)
          .select("nombre createdAt")
          .lean(),
        ActivationCode.find({ createdAt: { $gte: sinceDate } })
          .sort({ createdAt: -1 })
          .limit(10)
          .populate("userId", "nombre")
          .select("code createdAt userId")
          .lean(),
        ActivationCode.find({ status: "used", usedAt: { $gte: sinceDate } })
          .sort({ usedAt: -1 })
          .limit(10)
          .populate("userId", "nombre")
          .select("code usedAt userId")
          .lean(),
        ActivationCode.find({ status: "revoked", updatedAt: { $gte: sinceDate } })
          .sort({ updatedAt: -1 })
          .limit(10)
          .populate("userId", "nombre")
          .select("code updatedAt userId")
          .lean(),
        User.find({ rol: "cliente", isActivated: true, activatedAt: { $gte: sinceDate } })
          .sort({ activatedAt: -1 })
          .limit(10)
          .select("nombre activatedAt")
          .lean(),
      ]);

    const recentActivity = [
      ...recentClients.map((item) => ({
        type: "CLIENT_REGISTERED",
        label: `Se registró el cliente ${item.nombre}`,
        timestamp: item.createdAt,
      })),
      ...recentCodesCreated.map((item) => ({
        type: "CODE_CREATED",
        label: `Código ${item.code} creado para ${item.userId?.nombre || "cliente"}`,
        timestamp: item.createdAt,
      })),
      ...recentCodesUsed.map((item) => ({
        type: "CODE_USED",
        label: `Código ${item.code} usado por ${item.userId?.nombre || "cliente"}`,
        timestamp: item.usedAt,
      })),
      ...recentCodesRevoked.map((item) => ({
        type: "CODE_REVOKED",
        label: `Código ${item.code} revocado para ${item.userId?.nombre || "cliente"}`,
        timestamp: item.updatedAt,
      })),
      ...recentUsersActivated.map((item) => ({
        type: "CLIENT_ACTIVATED",
        label: `Cliente ${item.nombre} activó su acceso`,
        timestamp: item.activatedAt,
      })),
    ]
      .filter((item) => Boolean(item.timestamp))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map((item) => ({
        ...item,
        timestamp: new Date(item.timestamp).toISOString(),
      }));

    return res.json({
      ok: true,
      range,
      totals: {
        clientsRegistered,
        clientsActivated,
        codesActive,
        codesUsed,
        codesRevoked,
        clientsPendingActivation,
        manualsGenerated,
        avgActivationTimeHours,
      },
      charts: {
        activationsByMonth,
        statusDistribution: {
          activated: clientsActivated,
          notActivated: notActivatedNoCode,
          codeAssigned,
        },
      },
      topClients,
      recentActivity,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible cargar metricas",
      details: error.message,
    });
  }
};

const getEstadisticasOverview = async (_req, res) => {
  try {
    const [totalClientes, clientesActivados, clientesNoActivados, totalCodigos, codigosActivos, codigosUsados, codigosRevocados] =
      await Promise.all([
        User.countDocuments({ rol: "cliente" }),
        User.countDocuments({ rol: "cliente", isActivated: true }),
        User.countDocuments({ rol: "cliente", isActivated: false }),
        ActivationCode.countDocuments(),
        ActivationCode.countDocuments({ status: "active" }),
        ActivationCode.countDocuments({ status: "used" }),
        ActivationCode.countDocuments({ status: "revoked" }),
      ]);

    const tasaActivacionPct = totalClientes
      ? Number(((clientesActivados / totalClientes) * 100).toFixed(1))
      : 0;
    const tasaUsoCodigoPct = totalCodigos
      ? Number(((codigosUsados / totalCodigos) * 100).toFixed(1))
      : 0;

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const codesCreatedRaw = await ActivationCode.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          created: { $sum: 1 },
        },
      },
    ]);

    const codesUsedRaw = await ActivationCode.aggregate([
      { $match: { usedAt: { $gte: sevenDaysAgo }, status: "used" } },
      {
        $group: {
          _id: {
            year: { $year: "$usedAt" },
            month: { $month: "$usedAt" },
            day: { $dayOfMonth: "$usedAt" },
          },
          used: { $sum: 1 },
        },
      },
    ]);

    const createdMap = new Map();
    for (const item of codesCreatedRaw) {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, "0")}-${String(item._id.day).padStart(2, "0")}`;
      createdMap.set(key, item.created);
    }

    const usedMap = new Map();
    for (const item of codesUsedRaw) {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, "0")}-${String(item._id.day).padStart(2, "0")}`;
      usedMap.set(key, item.used);
    }

    const codigosUltimos7Dias = [];
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      codigosUltimos7Dias.push({
        date: key,
        created: createdMap.get(key) || 0,
        used: usedMap.get(key) || 0,
      });
    }

    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const activacionesRaw = await User.aggregate([
      {
        $match: {
          rol: "cliente",
          isActivated: true,
          activatedAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$activatedAt" },
            month: { $month: "$activatedAt" },
          },
          activated: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const activacionesMap = new Map();
    for (const item of activacionesRaw) {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;
      activacionesMap.set(key, item.activated);
    }

    const activacionesUltimos6Meses = [];
    for (let i = 0; i < 6; i += 1) {
      const date = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      activacionesUltimos6Meses.push({
        month: key,
        activated: activacionesMap.get(key) || 0,
      });
    }

    const [lastClientCreated, lastCodeCreated, lastCodeUsed] = await Promise.all([
      User.findOne({ rol: "cliente" }).sort({ createdAt: -1 }).select("nombre email createdAt").lean(),
      ActivationCode.findOne()
        .sort({ createdAt: -1 })
        .populate("userId", "nombre email")
        .select("code createdAt userId")
        .lean(),
      ActivationCode.findOne({ status: "used", usedAt: { $ne: null } })
        .sort({ usedAt: -1 })
        .populate("userId", "nombre email")
        .select("code usedAt userId")
        .lean(),
    ]);

    return res.json({
      ok: true,
      kpis: {
        totalClientes,
        clientesActivados,
        clientesNoActivados,
        totalCodigos,
        codigosActivos,
        codigosUsados,
        codigosRevocados,
        tasaActivacionPct,
        tasaUsoCodigoPct,
      },
      charts: {
        codigosPorEstado: {
          active: codigosActivos,
          used: codigosUsados,
          revoked: codigosRevocados,
        },
        clientesPorEstado: {
          activated: clientesActivados,
          notActivated: clientesNoActivados,
        },
        codigosUltimos7Dias,
        activacionesUltimos6Meses,
      },
      lastUpdates: {
        lastClientCreatedAt: lastClientCreated?.createdAt || null,
        lastCodeCreatedAt: lastCodeCreated?.createdAt || null,
        lastCodeUsedAt: lastCodeUsed?.usedAt || null,
        lastClient: lastClientCreated
          ? {
              name: lastClientCreated.nombre,
              email: lastClientCreated.email,
              createdAt: lastClientCreated.createdAt,
            }
          : null,
        lastCodeCreated: lastCodeCreated
          ? {
              code: lastCodeCreated.code,
              clientName: lastCodeCreated.userId?.nombre || null,
              clientEmail: lastCodeCreated.userId?.email || null,
              createdAt: lastCodeCreated.createdAt,
            }
          : null,
        lastCodeUsed: lastCodeUsed
          ? {
              code: lastCodeUsed.code,
              clientName: lastCodeUsed.userId?.nombre || null,
              clientEmail: lastCodeUsed.userId?.email || null,
              usedAt: lastCodeUsed.usedAt,
            }
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "No fue posible cargar estadisticas",
      details: error.message,
    });
  }
};

module.exports = {
  getClientes,
  createCodigoCliente,
  revokeCodigo,
  getCodigos,
  getCodigosOverview,
  deleteCodigo,
  getMetricsOverview,
  getEstadisticasOverview,
};
