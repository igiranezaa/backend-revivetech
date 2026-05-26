import { prisma } from "../config/prisma.js";

type AuditLogInput = {
  action: string;
  details: string;
  userId?: string | null;
};

export const writeAuditLog = ({ action, details, userId = null }: AuditLogInput) => {
  return prisma.systemLog.create({
    data: {
      action,
      details,
      userId,
    },
  });
};
