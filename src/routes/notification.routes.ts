import { Router } from "express";
import { UserRole } from "@prisma/client";
import {
  adminBroadcastNotification,
  adminCreateNotification,
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controller/notification.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, listNotifications);
router.get("/unread-count", requireAuth, getUnreadNotificationCount);
router.patch("/read-all", requireAuth, markAllNotificationsRead);
router.patch("/:id/read", requireAuth, markNotificationRead);
router.delete("/:id", requireAuth, deleteNotification);

router.post("/", requireAuth, requireRoles([UserRole.ADMIN]), adminCreateNotification);
router.post("/broadcast", requireAuth, requireRoles([UserRole.ADMIN]), adminBroadcastNotification);

export default router;
