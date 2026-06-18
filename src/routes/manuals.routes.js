const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const manualsController = require("../controllers/manuals.controller");

const router = express.Router();

router.post(
  "/:manualKey/generar-ia",
  authMiddleware,
  allowRoles("colaborador", "admin"),
  manualsController.createManualGenerationJob
);

router.get(
  "/jobs/:jobId",
  authMiddleware,
  allowRoles("colaborador", "admin"),
  manualsController.getManualGenerationJob
);

router.get(
  "/jobs/:jobId/descargar",
  authMiddleware,
  allowRoles("colaborador", "admin"),
  manualsController.downloadManualGenerationJob
);

module.exports = router;
