const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const dashboardController = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/resumen", authMiddleware, dashboardController.getResumen);
router.get("/documentos", authMiddleware, dashboardController.getDocumentos);
router.get("/estado", authMiddleware, dashboardController.getEstado);

module.exports = router;
