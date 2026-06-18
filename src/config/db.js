const mongoose = require("mongoose");
const User = require("../models/User");

const ADMIN_SEED = {
  nombre: "Administrador AeroXpert",
  email: "admin@aeroxpert.com",
  passwordHash: "$2b$10$OH6hSDIaJABuUWDIqKEm1ezifcbEyFP/sWShQ/eM0hsDvMN9ZmXDi",
  rol: "admin",
};

const COLABORADOR_SEED = {
  nombre: "Juan Serna",
  email: "juanserna9809@gmail.com",
  passwordHash: "$2b$10$1yoxvNK4JzqVky6/P8GVnOBQZpue/IEr.EcWRtQzhzR0XhsqgRQZq",
  rol: "colaborador",
};

const ensureInitialAdminUser = async () => {
  const exists = await User.findOne({ email: ADMIN_SEED.email }).lean();
  if (exists) {
    return;
  }

  await User.create({
    nombre: ADMIN_SEED.nombre,
    email: ADMIN_SEED.email,
    passwordHash: ADMIN_SEED.passwordHash,
    rol: ADMIN_SEED.rol,
    isActivated: true,
    activatedAt: new Date(),
  });
};

const ensureInitialColaboradorUser = async () => {
  const exists = await User.findOne({ email: COLABORADOR_SEED.email }).lean();
  if (exists) {
    return;
  }

  await User.create({
    nombre: COLABORADOR_SEED.nombre,
    email: COLABORADOR_SEED.email,
    passwordHash: COLABORADOR_SEED.passwordHash,
    rol: COLABORADOR_SEED.rol,
    isActivated: true,
    activatedAt: new Date(),
  });
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    await ensureInitialAdminUser();
    await ensureInitialColaboradorUser();

    console.log(` MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error("Error conectando MongoDB:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
