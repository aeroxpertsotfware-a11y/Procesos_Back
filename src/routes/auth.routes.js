const express = require("express");
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authMiddleware, authController.me);
router.post("/change-password", authMiddleware, authController.changePassword);
router.post("/sessions/close-others", authMiddleware, authController.closeOtherSessions);

module.exports = router;
