import { Router } from "express";
import {
  deleteDevice,
  deleteTradeIn,
  getDevice,
  getTradeIn,
  listDevices,
  intakeDevice,
  updateDevice,
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
router.get("/", requireAuth, requireRoles([UserRole.TECHNICIAN, UserRole.ADMIN]), listDevices);
router.post("/intake", requireAuth, requireRoles([UserRole.TECHNICIAN, UserRole.ADMIN]), intakeDevice);
router.post("/repair", requireAuth, requireRoles([UserRole.TECHNICIAN]), updateRepairStatus);
router.post("/qc", requireAuth, requireRoles([UserRole.TECHNICIAN]), submitQcCheck);
router.post("/certify", requireAuth, requireRoles([UserRole.TECHNICIAN]), certifyDevice);

// Public / Authenticated route to view device passport
router.get("/passport/:deviceId", getDigitalPassport);

// Customer Trade-In routes
router.post("/trade-in", requireAuth, submitTradeIn);

// Management Trade-In routes
router.get("/trade-in", requireAuth, listTradeIns);
router.get("/trade-in/:id", requireAuth, getTradeIn);
router.put("/trade-in", requireAuth, requireRoles([UserRole.ADMIN, UserRole.FINANCE_OFFICER]), reviewTradeIn);
router.put("/trade-in/:id", requireAuth, requireRoles([UserRole.ADMIN, UserRole.FINANCE_OFFICER]), reviewTradeIn);
router.delete("/trade-in/:id", requireAuth, deleteTradeIn);

router.get("/:id", requireAuth, requireRoles([UserRole.TECHNICIAN, UserRole.ADMIN]), getDevice);
router.put("/:id", requireAuth, requireRoles([UserRole.TECHNICIAN, UserRole.ADMIN]), updateDevice);
router.delete("/:id", requireAuth, requireRoles([UserRole.ADMIN]), deleteDevice);

export default router;
