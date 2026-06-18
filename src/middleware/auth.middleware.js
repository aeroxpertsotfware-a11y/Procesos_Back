const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload.sub;

    if (!userId) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const user = await User.findById(userId);

    if (!user || !user.activo) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const sessionId = String(payload.sid || "").trim();
    const activeSession = (user.sessions || []).find((item) => item.sessionId === sessionId);

    if (!sessionId || !activeSession) {
      return res.status(401).json({ message: "No autorizado" });
    }

    activeSession.lastSeenAt = new Date();
    await user.save();

    req.user = user;
    req.auth = {
      userId,
      sessionId,
      role: payload.rol,
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: "No autorizado" });
  }
};

module.exports = authMiddleware;
