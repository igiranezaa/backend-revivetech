import { prisma } from "../config/prisma.js";
import type { UserRole } from "@prisma/client";

type CreateNotificationInput = {
  userId: string;
  type: string;
  message: string;
};

type BroadcastNotificationInput = {
  type: string;
  message: string;
  role?: UserRole;
};

export class NotificationService {
  static createNotification({ userId, type, message }: CreateNotificationInput) {
    return prisma.notification.create({
      data: {
        userId,
        type,
        message,
      },
    });
  }

  static async broadcastNotification({ type, message, role }: BroadcastNotificationInput): Promise<number> {
    const users = await prisma.user.findMany({
      ...(role ? { where: { role } } : {}),
      select: { id: true },
    });

    if (users.length === 0) {
      return 0;
    }

    const result = await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type,
        message,
      })),
    });

    return result.count;
  }
}
