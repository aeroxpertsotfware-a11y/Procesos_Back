const User = require("../models/User");
const Manual = require("../models/Manual");

const getUsuarios = async (_req, res) => {
  try {
    const users = await User.find({}, { passwordHash: 0 })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ users });
  } catch (error) {
    return res.status(500).json({
      message: "Error interno",
      details: error.message,
    });
  }
};

const getEstadisticas = async (_req, res) => {
  try {
    const [totalUsuarios, totalColaboradores, totalManuales, totalManualesGenerados, latestManual] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ rol: "colaborador" }),
        Manual.countDocuments(),
        Manual.countDocuments({ "versions.0": { $exists: true } }),
        Manual.findOne().sort({ updatedAt: -1, createdAt: -1 }).select("updatedAt createdAt").lean(),
      ]);

    const ultimaActualizacion =
      latestManual?.updatedAt || latestManual?.createdAt || new Date();

    return res.json({
      totalUsuarios,
      totalManuales,
      totalManualesGenerados,
      totalColaboradores,
      ultimaActualizacion,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error interno",
      details: error.message,
    });
  }
};

module.exports = {
  getUsuarios,
  getEstadisticas,
};
