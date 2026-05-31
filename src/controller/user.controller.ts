import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../config/prisma.js";
import { UserRole, UserStatus } from "@prisma/client";
import { writeAuditLog } from "../utils/audit-log.js";
import { parseOptionalString } from "../utils/request.js";

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
      where: { status: { not: UserStatus.DELETED } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
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

export const adminGetUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "User id is required" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        devicesOwned: true,
        financingApplications: true,
        orders: true,
        tradeInRequests: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({ user });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to get user", error: error.message });
  }
};

export const adminUpdateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "User id is required" });
      return;
    }

    const { firstName, lastName, phone, role, status, isVerified } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (role && !Object.values(UserRole).includes(role)) {
      res.status(400).json({ message: `Invalid role. Allowed roles: ${Object.values(UserRole).join(", ")}` });
      return;
    }

    if (status && !Object.values(UserStatus).includes(status)) {
      res.status(400).json({ message: `Invalid status. Allowed statuses: ${Object.values(UserStatus).join(", ")}` });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(role ? { role: role as UserRole } : {}),
        ...(status ? { status: status as UserStatus } : {}),
        ...(isVerified !== undefined ? { isVerified: Boolean(isVerified) } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        isVerified: true,
        updatedAt: true,
      },
    });

    await writeAuditLog({
      action: "ADMIN_UPDATE_USER",
      details: `Admin ${req.user?.email} updated user ${updatedUser.email}.`,
      userId: req.user?.id || null,
    });

    res.status(200).json({ message: "User updated successfully", user: updatedUser });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to update user", error: error.message });
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

export const adminDeleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "User id is required" });
      return;
    }

    if (id === req.user?.id) {
      res.status(400).json({ message: "Admins cannot delete their own account from this endpoint" });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    await prisma.$transaction(async transaction => {
      await transaction.device.updateMany({
        where: { ownerId: id },
        data: { ownerId: null },
      });
      await transaction.financingApplication.updateMany({
        where: { approvedById: id },
        data: { approvedById: null },
      });
      await transaction.payment.deleteMany({
        where: {
          OR: [
            { userId: id },
            { order: { customerId: id } },
          ],
        },
      });
      await transaction.order.deleteMany({ where: { customerId: id } });
      await transaction.financingApplication.deleteMany({ where: { customerId: id } });
      await transaction.tradeInRequest.deleteMany({ where: { userId: id } });
      await transaction.supportChatSession.deleteMany({ where: { customerId: id } });
      await transaction.repairLog.deleteMany({ where: { technicianId: id } });
      await transaction.aiInteraction.deleteMany({ where: { userId: id } });
      await transaction.user.delete({ where: { id } });
    });

    await writeAuditLog({
      action: "ADMIN_DELETE_USER",
      details: `Admin ${req.user?.email} deleted user ${existingUser.email}.`,
      userId: req.user?.id || null,
    });

    res.status(200).json({ message: "User permanently deleted from the database" });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to delete user", error: error.message });
  }
};
