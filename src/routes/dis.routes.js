const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const disController = require("../controllers/dis.controller");

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  allowRoles("cliente"),
  disController.createDis
);

router.get(
  "/:clientId",
  authMiddleware,
  allowRoles("cliente", "admin"),
  disController.getDisByClientId
);

router.put(
  "/:id",
  authMiddleware,
  allowRoles("cliente"),
  disController.updateDis
);

module.exports = router;
