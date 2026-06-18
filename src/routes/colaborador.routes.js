const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const colaboradorController = require("../controllers/colaborador.controller");
const disController = require("../controllers/dis.controller");

const router = express.Router();

router.get(
  "/usuarios",
  authMiddleware,
  allowRoles("colaborador", "admin"),
  colaboradorController.getUsuarios
);
router.get(
  "/estadisticas",
  authMiddleware,
  allowRoles("colaborador", "admin"),
  colaboradorController.getEstadisticas
);
router.post(
  "/dis/generar",
  authMiddleware,
  allowRoles("colaborador", "admin"),
  disController.generateDisDocument
);

module.exports = router;
