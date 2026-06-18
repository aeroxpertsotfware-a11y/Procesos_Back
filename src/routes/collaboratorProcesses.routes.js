const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const collaboratorProcessesController = require("../controllers/collaboratorProcesses.controller");

const router = express.Router();

router.get(
  "/active",
  authMiddleware,
  allowRoles("colaborador"),
  collaboratorProcessesController.getActiveProcesses
);

router.get(
  "/:clientId",
  authMiddleware,
  allowRoles("colaborador"),
  collaboratorProcessesController.getProcessDetail
);

router.put(
  "/:clientId/status",
  authMiddleware,
  allowRoles("colaborador"),
  collaboratorProcessesController.updateProcessStatus
);

router.put(
  "/:clientId/document",
  authMiddleware,
  allowRoles("colaborador"),
  collaboratorProcessesController.updateProcessDocument
);

router.put(
  "/:clientId/dis",
  authMiddleware,
  allowRoles("colaborador"),
  collaboratorProcessesController.updateProcessDis
);

router.post(
  "/:clientId/observation",
  authMiddleware,
  allowRoles("colaborador"),
  collaboratorProcessesController.createProcessObservation
);

module.exports = router;
