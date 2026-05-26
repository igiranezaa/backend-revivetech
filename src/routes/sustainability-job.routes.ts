import { Router } from "express";
import { UserRole } from "@prisma/client";
import {
  createSustainabilityJob,
  listSustainabilityJobs,
  updateSustainabilityJob,
} from "../controller/sustainability-job.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, listSustainabilityJobs);
router.post("/", requireAuth, requireRoles([UserRole.ADMIN, UserRole.TECHNICIAN]), createSustainabilityJob);
router.put("/:id", requireAuth, requireRoles([UserRole.ADMIN, UserRole.TECHNICIAN]), updateSustainabilityJob);

export default router;
