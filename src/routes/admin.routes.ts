import { Router } from "express";
import {
  getDashboardStats,
  getSustainabilityReport,
  getInventoryPrediction,
} from "../controller/admin.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { UserRole } from "@prisma/client";

const router = Router();

// Stats and Predictions (restricted to Admin)
router.get("/stats", requireAuth, requireRoles([UserRole.ADMIN]), getDashboardStats);
router.get("/predictions", requireAuth, requireRoles([UserRole.ADMIN]), getInventoryPrediction);

// Sustainability report (readable by any logged in system user)
router.get("/sustainability", requireAuth, getSustainabilityReport);

export default router;
