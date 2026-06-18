const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const clientDashboardController = require("../controllers/clientDashboard.controller");

const router = express.Router();

router.get(
  "/dashboard-stats",
  authMiddleware,
  allowRoles("cliente"),
  clientDashboardController.getDashboardStats
);

router.get(
  "/recent-activity",
  authMiddleware,
  allowRoles("cliente"),
  clientDashboardController.getRecentActivity
);

router.get(
  "/timeline-status",
  authMiddleware,
  allowRoles("cliente"),
  clientDashboardController.getTimelineStatus
);

module.exports = router;
