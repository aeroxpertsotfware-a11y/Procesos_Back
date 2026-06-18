const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeRole = (role) => String(role || "").trim().toLowerCase();

const buildToken = (user, sessionId) => {
  return jwt.sign(
    { sub: user._id.toString(), rol: normalizeRole(user.rol), sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const buildSession = (req) => ({
  sessionId: crypto.randomUUID(),
  userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
  createdAt: new Date(),
  lastSeenAt: new Date(),
});

const serializeUser = (user) => ({
  id: user._id.toString(),
  nombre: String(user.nombre || "").trim(),
  email: String(user.email || "").trim().toLowerCase(),
  rol: normalizeRole(user.rol),
  isActivated: Boolean(user.isActivated),
  activatedAt: user.activatedAt || null,
  activationCodeId: user.activationCodeId ? user.activationCodeId.toString() : null,
});

const hasMissingFields = (fields) => fields.some((value) => !String(value || "").trim());

const register = async (req, res) => {
  try {
    const { nombre, email, password } = req.body || {};

    if (hasMissingFields([nombre, email, password])) {
      return res.status(400).json({ message: "Verifica los datos" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedNombre = String(nombre).trim();
    const normalizedPassword = String(password);

    if (!EMAIL_REGEX.test(normalizedEmail) || normalizedPassword.length < 8) {
      return res.status(400).json({ message: "Verifica los datos" });
    }

    const exists = await User.findOne({ email: normalizedEmail }).lean();

    if (exists) {
      return res.status(409).json({ message: "Email ya registrado" });
    }

    const hasAdmin = await User.exists({ rol: "admin" });
    const passwordHash = await bcrypt.hash(normalizedPassword, 10);

    const session = buildSession(req);

    const user = await User.create({
      nombre: normalizedNombre,
      email: normalizedEmail,
      passwordHash,
      rol: hasAdmin ? "cliente" : "admin",
      sessions: [session],
    });

    const token = buildToken(user, session.sessionId);

    return res.status(201).json({
      user: serializeUser(user),
      token,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error interno",
      details: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (hasMissingFields([email, password])) {
      return res.status(400).json({ message: "Campos faltantes" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.activo) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const isValidPassword = await bcrypt.compare(String(password), user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const session = buildSession(req);
    user.sessions = [...(user.sessions || []).filter((item) => item?.sessionId), session];
    await user.save();

    const token = buildToken(user, session.sessionId);

    return res.json({
      user: serializeUser(user),
      token,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error interno",
      details: error.message,
    });
  }
};

const me = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "No autorizado" });
    }

    return res.json({ user: serializeUser(req.user) });
  } catch (error) {
    return res.status(500).json({
      message: "Error interno",
      details: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    if (!req.user || !req.auth) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const { currentPassword, newPassword } = req.body || {};

    if (hasMissingFields([currentPassword, newPassword])) {
      return res.status(400).json({ message: "Completa los campos requeridos" });
    }

    if (String(newPassword).trim().length < 8) {
      return res.status(400).json({ message: "La nueva contrasena debe tener al menos 8 caracteres" });
    }

    const isValidPassword = await bcrypt.compare(String(currentPassword), req.user.passwordHash);

    if (!isValidPassword) {
      return res.status(400).json({ message: "La contrasena actual no es correcta" });
    }

    const samePassword = await bcrypt.compare(String(newPassword), req.user.passwordHash);

    if (samePassword) {
      return res.status(400).json({ message: "La nueva contrasena debe ser diferente a la actual" });
    }

    req.user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    req.user.sessions = (req.user.sessions || []).filter((item) => item.sessionId === req.auth.sessionId);
    await req.user.save();

    const token = buildToken(req.user, req.auth.sessionId);

    return res.json({
      message: "Contrasena actualizada correctamente",
      token,
      user: serializeUser(req.user),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error interno",
      details: error.message,
    });
  }
};

const closeOtherSessions = async (req, res) => {
  try {
    if (!req.user || !req.auth) {
      return res.status(401).json({ message: "No autorizado" });
    }

    req.user.sessions = (req.user.sessions || []).filter((item) => item.sessionId === req.auth.sessionId);
    await req.user.save();

    return res.json({
      message: "Las otras sesiones activas fueron cerradas correctamente",
      activeSessions: req.user.sessions.length,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error interno",
      details: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  me,
  changePassword,
  closeOtherSessions,
};
