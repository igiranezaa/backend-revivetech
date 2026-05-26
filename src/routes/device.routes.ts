import { Router } from "express";
import {
  intakeDevice,
  updateRepairStatus,
  submitQcCheck,
  certifyDevice,
  getDigitalPassport,
  submitTradeIn,
  listTradeIns,
  reviewTradeIn,
} from "../controller/device.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { UserRole } from "@prisma/client";

const router = Router();

// Technician & Admin Device management routes
router.post("/intake", requireAuth, requireRoles([UserRole.TECHNICIAN, UserRole.ADMIN]), intakeDevice);
router.post("/repair", requireAuth, requireRoles([UserRole.TECHNICIAN]), updateRepairStatus);
router.post("/qc", requireAuth, requireRoles([UserRole.TECHNICIAN]), submitQcCheck);
router.post("/certify", requireAuth, requireRoles([UserRole.TECHNICIAN]), certifyDevice);

// Public / Authenticated route to view device passport
router.get("/passport/:deviceId", getDigitalPassport);

// Customer Trade-In routes
router.post("/trade-in", requireAuth, submitTradeIn);

// Management Trade-In routes
router.get("/trade-in", requireAuth, requireRoles([UserRole.ADMIN, UserRole.FINANCE_OFFICER]), listTradeIns);
router.put("/trade-in", requireAuth, requireRoles([UserRole.ADMIN, UserRole.FINANCE_OFFICER]), reviewTradeIn);

export default router;
