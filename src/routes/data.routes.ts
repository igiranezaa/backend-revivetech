import { Router } from "express";
import { UserRole } from "@prisma/client";
import { getAllModelRecords, getModelRecordById, listDataModels } from "../controller/data.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = Router();

router.get("/models", requireAuth, requireRoles([UserRole.ADMIN]), listDataModels);
router.get("/:model", requireAuth, requireRoles([UserRole.ADMIN]), getAllModelRecords);
router.get("/:model/:id", requireAuth, requireRoles([UserRole.ADMIN]), getModelRecordById);

export default router;
