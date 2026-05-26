import { Router } from "express";
import {
  deleteFinancingApplication,
  listFinancingApplications,
  submitFinancing,
  getFinancingDetails,
  officerReviewFinancing,
  makeRepayment,
  updateFinancingApplication,
} from "../controller/payment.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { UserRole } from "@prisma/client";

const router = Router();

// Customer actions
router.get("/financing", requireAuth, listFinancingApplications);
router.post("/financing", requireAuth, submitFinancing);
router.get("/financing/:id", requireAuth, getFinancingDetails);
router.post("/repay", requireAuth, makeRepayment);

// Finance Officer / Admin actions
router.post("/financing/review", requireAuth, requireRoles([UserRole.FINANCE_OFFICER, UserRole.ADMIN]), officerReviewFinancing);
router.put("/financing/:id", requireAuth, requireRoles([UserRole.FINANCE_OFFICER, UserRole.ADMIN]), updateFinancingApplication);
router.delete("/financing/:id", requireAuth, requireRoles([UserRole.ADMIN]), deleteFinancingApplication);

export default router;
