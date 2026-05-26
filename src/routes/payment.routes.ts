import { Router } from "express";
import {
  submitFinancing,
  getFinancingDetails,
  officerReviewFinancing,
  makeRepayment,
} from "../controller/payment.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { UserRole } from "@prisma/client";

const router = Router();

// Customer actions
router.post("/financing", requireAuth, submitFinancing);
router.get("/financing/:id", requireAuth, getFinancingDetails);
router.post("/repay", requireAuth, makeRepayment);

// Finance Officer / Admin actions
router.post("/financing/review", requireAuth, requireRoles([UserRole.FINANCE_OFFICER, UserRole.ADMIN]), officerReviewFinancing);

export default router;
