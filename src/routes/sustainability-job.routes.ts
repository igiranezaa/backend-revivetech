import { Router } from "express";
import { UserRole } from "@prisma/client";
import {
  createSustainabilityJob,
  deleteSustainabilityJob,
  getSustainabilityJob,
  listSustainabilityJobs,
  updateSustainabilityJob,
} from "../controller/sustainability-job.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, listSustainabilityJobs);
router.get("/:id", requireAuth, getSustainabilityJob);
router.post("/", requireAuth, requireRoles([UserRole.ADMIN, UserRole.TECHNICIAN]), createSustainabilityJob);
router.put("/:id", requireAuth, requireRoles([UserRole.ADMIN, UserRole.TECHNICIAN]), updateSustainabilityJob);
router.delete("/:id", requireAuth, requireRoles([UserRole.ADMIN]), deleteSustainabilityJob);

export default router;
