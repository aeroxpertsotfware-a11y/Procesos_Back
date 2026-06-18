const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const expedienteDocsController = require("../controllers/expedienteDocs.controller");

const router = express.Router();

router.get(
  "/:clienteId/documentos",
  authMiddleware,
  allowRoles("colaborador", "admin"),
  expedienteDocsController.listExpedienteDocumentos
);

router.post(
  "/:clienteId/documentos",
  authMiddleware,
  allowRoles("colaborador", "admin"),
  (req, res, next) => {
    expedienteDocsController.upload.single("file")(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "El archivo supera el maximo permitido de 20MB.",
        });
      }

      return res.status(400).json({
        message: "No fue posible procesar el archivo adjunto.",
        details: error.message,
      });
    });
  },
  expedienteDocsController.createExpedienteDocumento
);

router.get(
  "/documentos/:docId/download",
  authMiddleware,
  allowRoles("colaborador", "admin"),
  expedienteDocsController.downloadExpedienteDocumento
);

router.patch(
  "/documentos/:docId",
  authMiddleware,
  allowRoles("colaborador", "admin"),
  expedienteDocsController.patchExpedienteDocumento
);

router.delete(
  "/documentos/:docId",
  authMiddleware,
  allowRoles("colaborador", "admin"),
  expedienteDocsController.deleteExpedienteDocumento
);

module.exports = router;
