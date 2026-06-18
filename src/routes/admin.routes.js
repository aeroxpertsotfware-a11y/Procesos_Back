const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const adminController = require("../controllers/admin.controller");

const router = express.Router();

router.get(
  "/clientes",
  authMiddleware,
  allowRoles("admin"),
  adminController.getClientes
);
router.get(
  "/codigos",
  authMiddleware,
  allowRoles("admin"),
  adminController.getCodigos
);
router.get(
  "/codigos/overview",
  authMiddleware,
  allowRoles("admin"),
  adminController.getCodigosOverview
);
router.get(
  "/metrics/overview",
  authMiddleware,
  allowRoles("admin"),
  adminController.getMetricsOverview
);
router.get(
  "/estadisticas/overview",
  authMiddleware,
  allowRoles("admin"),
  adminController.getEstadisticasOverview
);
router.post(
  "/clientes/:userId/crear-codigo",
  authMiddleware,
  allowRoles("admin"),
  adminController.createCodigoCliente
);
router.post(
  "/codigos/:code/revocar",
  authMiddleware,
  allowRoles("admin"),
  adminController.revokeCodigo
);
router.delete(
  "/codigos/:code",
  authMiddleware,
  allowRoles("admin"),
  adminController.deleteCodigo
);

module.exports = router;
