const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const clienteController = require("../controllers/cliente.controller");

const router = express.Router();

router.post(
  "/activar",
  authMiddleware,
  clienteController.activateCliente
);

router.get(
  "/expediente",
  authMiddleware,
  allowRoles("cliente"),
  clienteController.getExpediente
);

router.put(
  "/expediente/company-data",
  authMiddleware,
  allowRoles("cliente"),
  clienteController.saveCompanyData
);

router.post(
  "/documentos/upload",
  authMiddleware,
  allowRoles("cliente"),
  (req, res, next) => {
    clienteController.upload.single("archivo")(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "El archivo supera el máximo permitido de 10MB",
        });
      }

      return res.status(400).json({
        message: "No fue posible procesar el archivo adjunto",
        details: error.message,
      });
    });
  },
  clienteController.uploadDocumento
);

module.exports = router;
