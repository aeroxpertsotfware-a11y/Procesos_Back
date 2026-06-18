const allowRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = String(req.user?.rol || "").trim().toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map((role) => String(role || "").trim().toLowerCase());

    if (!userRole || !normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "No autorizado para este recurso" });
    }

    return next();
  };
};

module.exports = allowRoles;
