import { Router } from "express";
import { getProfile, updateProfile, adminListUsers, adminUpdateRole } from "../controller/user.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { UserRole } from "@prisma/client";

const router = Router();

router.get("/profile", requireAuth, getProfile);
router.put("/profile", requireAuth, updateProfile);

// Admin-only actions
router.get("/admin/users", requireAuth, requireRoles([UserRole.ADMIN]), adminListUsers);
router.put("/admin/role", requireAuth, requireRoles([UserRole.ADMIN]), adminUpdateRole);

export default router;
