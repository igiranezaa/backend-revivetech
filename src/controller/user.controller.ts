import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../config/prisma.js";
import { UserRole } from "@prisma/client";
import { writeAuditLog } from "../utils/audit-log.js";

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    res.status(200).json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to get profile", error: error.message });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const { firstName, lastName, phone } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
        phone: phone !== undefined ? phone : user.phone,
      },
    });

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
};

export const adminListUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ users });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to list users", error: error.message });
  }
};

export const adminUpdateRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, role } = req.body;

    if (!userId || !role) {
      res.status(400).json({ message: "Required fields: userId, role" });
      return;
    }

    if (!Object.values(UserRole).includes(role)) {
      res.status(400).json({ message: `Invalid role. Allowed roles: ${Object.values(UserRole).join(", ")}` });
      return;
    }

    const userToUpdate = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToUpdate) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
    });

    await writeAuditLog({
      action: "ADMIN_UPDATE_ROLE",
      details: `Admin ${req.user?.email} updated role of ${updatedUser.email} to ${updatedUser.role}.`,
      userId: req.user?.id || null,
    });

    res.status(200).json({
      message: `User role updated successfully to ${updatedUser.role}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to update user role", error: error.message });
  }
};
