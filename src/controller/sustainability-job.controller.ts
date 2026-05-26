import type { Response } from "express";
import { Prisma, SustainabilityJobStatus, SustainabilityJobType } from "@prisma/client";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../config/prisma.js";
import { writeAuditLog } from "../utils/audit-log.js";
import { parseOptionalNumber, parseOptionalString, sendMissingFields } from "../utils/request.js";

export const createSustainabilityJob = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, type, deviceId, assignedToId, eWasteSavedKg, carbonSavedKg } = req.body;

    if (!title) {
      sendMissingFields(res, ["title"]);
      return;
    }

    const jobType = type && Object.values(SustainabilityJobType).includes(type)
      ? (type as SustainabilityJobType)
      : SustainabilityJobType.REFURBISHMENT;

    const job = await prisma.sustainabilityJob.create({
      data: {
        title,
        description,
        type: jobType,
        deviceId: deviceId || null,
        assignedToId: assignedToId || req.user?.id || null,
        eWasteSavedKg: parseOptionalNumber(eWasteSavedKg),
        carbonSavedKg: parseOptionalNumber(carbonSavedKg),
      },
      include: {
        device: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await writeAuditLog({
      action: "SUSTAINABILITY_JOB_CREATE",
      details: `Sustainability job ${job.id} created: ${job.title}.`,
      userId: req.user?.id || null,
    });

    res.status(201).json({ message: "Sustainability job created successfully", job });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to create sustainability job", error: error.message });
  }
};

export const listSustainabilityJobs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, type } = req.query;

    const where = {
      ...(status && Object.values(SustainabilityJobStatus).includes(status as SustainabilityJobStatus)
        ? { status: status as SustainabilityJobStatus }
        : {}),
      ...(type && Object.values(SustainabilityJobType).includes(type as SustainabilityJobType)
        ? { type: type as SustainabilityJobType }
        : {}),
    };

    const jobs = await prisma.sustainabilityJob.findMany({
      where,
      include: {
        device: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ jobs });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to list sustainability jobs", error: error.message });
  }
};

export const updateSustainabilityJob = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);
    const { title, description, type, status, deviceId, assignedToId, eWasteSavedKg, carbonSavedKg } = req.body;
    if (!id) {
      sendMissingFields(res, ["id"]);
      return;
    }

    const existing = await prisma.sustainabilityJob.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: "Sustainability job not found" });
      return;
    }

    const nextStatus = status && Object.values(SustainabilityJobStatus).includes(status)
      ? (status as SustainabilityJobStatus)
      : undefined;

    const data: Prisma.SustainabilityJobUncheckedUpdateInput = {};

    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (type && Object.values(SustainabilityJobType).includes(type)) data.type = type as SustainabilityJobType;
    if (nextStatus) data.status = nextStatus;
    if (deviceId !== undefined) data.deviceId = deviceId || null;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
    if (eWasteSavedKg !== undefined) data.eWasteSavedKg = parseOptionalNumber(eWasteSavedKg);
    if (carbonSavedKg !== undefined) data.carbonSavedKg = parseOptionalNumber(carbonSavedKg);
    if (nextStatus === SustainabilityJobStatus.COMPLETED) data.completedAt = new Date();

    const job = await prisma.sustainabilityJob.update({
      where: { id },
      data,
      include: {
        device: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await writeAuditLog({
      action: "SUSTAINABILITY_JOB_UPDATE",
      details: `Sustainability job ${job.id} updated.`,
      userId: req.user?.id || null,
    });

    res.status(200).json({ message: "Sustainability job updated successfully", job });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to update sustainability job", error: error.message });
  }
};
