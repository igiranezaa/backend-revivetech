import type { Response } from "express";
import { UserRole } from "@prisma/client";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../config/prisma.js";
import { NotificationService } from "../services/notification.service.js";
import { parseOptionalNumber, parseOptionalString, sendMissingFields } from "../utils/request.js";
import { writeAuditLog } from "../utils/audit-log.js";

export const listNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const page = Math.max(parseOptionalNumber(req.query["page"], 1), 1);
    const limit = Math.min(Math.max(parseOptionalNumber(req.query["limit"], 20), 1), 100);
    const readQuery = req.query["read"];
    const read = readQuery === "true" ? true : readQuery === "false" ? false : undefined;

    const where = {
      userId: req.user.id,
      ...(read !== undefined ? { read } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user.id, read: false } }),
    ]);

    res.status(200).json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to list notifications", error: error.message });
  }
};

export const getUnreadNotificationCount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, read: false },
    });

    res.status(200).json({ unreadCount });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to count unread notifications", error: error.message });
  }
};

export const markNotificationRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "Notification id is required" });
      return;
    }

    const notification = await prisma.notification.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!notification) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.status(200).json({
      message: "Notification marked as read",
      notification: updatedNotification,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to mark notification as read", error: error.message });
  }
};

export const markAllNotificationsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const result = await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true },
    });

    res.status(200).json({
      message: "All notifications marked as read",
      updatedCount: result.count,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to mark all notifications as read", error: error.message });
  }
};

export const deleteNotification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "Notification id is required" });
      return;
    }

    const notification = await prisma.notification.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!notification) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    await prisma.notification.delete({ where: { id } });
    res.status(200).json({ message: "Notification deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to delete notification", error: error.message });
  }
};

export const adminCreateNotification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, type, message } = req.body;
    if (!userId || !type || !message) {
      sendMissingFields(res, ["userId", "type", "message"]);
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const notification = await NotificationService.createNotification({ userId, type, message });

    await writeAuditLog({
      action: "ADMIN_CREATE_NOTIFICATION",
      details: `Admin ${req.user?.email} created notification ${notification.id} for ${user.email}.`,
      userId: req.user?.id || null,
    });

    res.status(201).json({
      message: "Notification created successfully",
      notification,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to create notification", error: error.message });
  }
};

export const adminBroadcastNotification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type, message, role } = req.body;
    if (!type || !message) {
      sendMissingFields(res, ["type", "message"]);
      return;
    }

    if (role && !Object.values(UserRole).includes(role)) {
      res.status(400).json({ message: `Invalid role. Allowed roles: ${Object.values(UserRole).join(", ")}` });
      return;
    }

    const broadcastInput = {
      type,
      message,
      ...(role ? { role: role as UserRole } : {}),
    };

    const createdCount = await NotificationService.broadcastNotification(broadcastInput);

    await writeAuditLog({
      action: "ADMIN_BROADCAST_NOTIFICATION",
      details: `Admin ${req.user?.email} broadcast notification to ${createdCount} user(s).`,
      userId: req.user?.id || null,
    });

    res.status(201).json({
      message: "Notification broadcast completed",
      createdCount,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to broadcast notification", error: error.message });
  }
};
