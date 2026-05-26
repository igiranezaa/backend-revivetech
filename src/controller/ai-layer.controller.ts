import type { Response } from "express";
import { AiInteractionType } from "@prisma/client";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../config/prisma.js";

export const listAiInteractions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type, userId } = req.query;

    const interactions = await prisma.aiInteraction.findMany({
      where: {
        ...(type && Object.values(AiInteractionType).includes(type as AiInteractionType)
          ? { type: type as AiInteractionType }
          : {}),
        ...(userId ? { userId: userId as string } : {}),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        session: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.status(200).json({ interactions });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to list AI interactions", error: error.message });
  }
};
