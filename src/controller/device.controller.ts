import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../config/prisma.js";
import { DeviceCondition, DeviceStatus, ListingStatus, TradeInStatus, UserRole } from "@prisma/client";
import { AiService } from "../services/ai.service.js";
import { writeAuditLog } from "../utils/audit-log.js";
import { parseOptionalString } from "../utils/request.js";
import { cloudinary } from "../config/cloudinary.js";

const uploadDeviceImage = (file: Express.Multer.File): Promise<string> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "revivetech/devices", resource_type: "image" },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error || new Error("Cloudinary did not return an image URL"));
          return;
        }
        resolve(result.secure_url);
      },
    );
    stream.end(file.buffer);
  });

// Helper to estimate carbon and e-waste offsets
const calculateSustainabilityMetrics = (brand: string, model: string) => {
  const brandLower = brand.toLowerCase();
  const modelLower = model.toLowerCase();

  let eWasteSavedKg = 0.2; // Default for phones
  let carbonSavedKg = 55.0; // Default for phones

  if (modelLower.includes("macbook") || modelLower.includes("laptop")) {
    eWasteSavedKg = 1.6;
    carbonSavedKg = 220.0;
  } else if (modelLower.includes("ipad") || modelLower.includes("tablet") || modelLower.includes("tab")) {
    eWasteSavedKg = 0.5;
    carbonSavedKg = 110.0;
  } else if (brandLower.includes("apple")) {
    carbonSavedKg = 70.0;
  } else if (brandLower.includes("samsung")) {
    carbonSavedKg = 60.0;
  }

  return { eWasteSavedKg, carbonSavedKg };
};

// Helper to compute Smart Trust Score
const calculateTrustScore = (condition: DeviceCondition, batteryHealth: number, repairHistoryCount: number) => {
  let score = 100.0;

  // Deduct based on condition
  if (condition === "EXCELLENT") score -= 5;
  else if (condition === "GOOD") score -= 12;
  else if (condition === "FAIR") score -= 22;
  else if (condition === "POOR") score -= 35;

  // Deduct for battery degradation
  if (batteryHealth < 80) {
    score -= 15;
  } else if (batteryHealth < 90) {
    score -= 5;
  }

  // Small deduction per repair log (more repairs = slightly lower trust score)
  score -= Math.min(10, repairHistoryCount * 2);

  return Math.max(30.0, Math.min(100.0, score));
};

export const intakeDevice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { brand, model, originalSerialNumber, condition, batteryHealth, basePrice, price, warehouse, stock } = req.body;

    if (!brand || !model || !condition || basePrice === undefined || price === undefined) {
      res.status(400).json({ message: "Required fields: brand, model, condition, basePrice, price" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: "A device picture is required" });
      return;
    }

    const { eWasteSavedKg, carbonSavedKg } = calculateSustainabilityMetrics(brand, model);
    const trustScore = calculateTrustScore(condition, batteryHealth || 100, 0);
    const initialStock = stock !== undefined ? Number(stock) : 1;
    if (!Number.isInteger(initialStock) || initialStock < 0) {
      res.status(400).json({ message: "Stock must be a non-negative whole number" });
      return;
    }
    const imageUrl = await uploadDeviceImage(req.file);

    const device = await prisma.device.create({
      data: {
        brand,
        model,
        originalSerialNumber,
        condition: condition as DeviceCondition,
        status: DeviceStatus.INTAKE,
        batteryHealth: batteryHealth !== undefined ? batteryHealth : 100,
        basePrice,
        price,
        warehouse: warehouse || "Kigali Central",
        stock: initialStock,
        imageUrl,
        trustScore,
        eWasteSavedKg,
        carbonSavedKg,
      },
    });

    await writeAuditLog({
      action: "DEVICE_INTAKE",
      details: `Technician ${req.user?.email} registered device ${device.brand} ${device.model} (ID: ${device.id}).`,
      userId: req.user?.id || null,
    });

    res.status(201).json({ message: "Device registered in intake successfully", device });
  } catch (error: any) {
    res.status(500).json({ message: "Intake registration failed", error: error.message });
  }
};

export const listDevices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { brand, condition, status, ownerId, search } = req.query;

    const where: any = {};
    if (brand) where.brand = { contains: brand as string, mode: "insensitive" };
    if (condition && Object.values(DeviceCondition).includes(condition as DeviceCondition)) {
      where.condition = condition as DeviceCondition;
    }
    if (status && Object.values(DeviceStatus).includes(status as DeviceStatus)) {
      where.status = status as DeviceStatus;
    }
    if (ownerId) where.ownerId = ownerId as string;
    if (search) {
      where.OR = [
        { brand: { contains: search as string, mode: "insensitive" } },
        { model: { contains: search as string, mode: "insensitive" } },
        { originalSerialNumber: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const devices = await prisma.device.findMany({
      where,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        listings: true,
        passport: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ devices });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to list devices", error: error.message });
  }
};

export const getDevice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "Device id is required" });
      return;
    }

    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        repairLogs: true,
        passport: true,
        listings: true,
        refurbishments: true,
        sustainabilityJobs: true,
      },
    });

    if (!device) {
      res.status(404).json({ message: "Device not found" });
      return;
    }

    res.status(200).json({ device });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to get device", error: error.message });
  }
};

export const updateDevice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "Device id is required" });
      return;
    }

    const existingDevice = await prisma.device.findUnique({ where: { id }, include: { repairLogs: true } });
    if (!existingDevice) {
      res.status(404).json({ message: "Device not found" });
      return;
    }

    const {
      brand,
      model,
      originalSerialNumber,
      condition,
      status,
      batteryHealth,
      repairNotes,
      basePrice,
      price,
      ownerId,
    } = req.body;

    if (condition && !Object.values(DeviceCondition).includes(condition)) {
      res.status(400).json({ message: "Invalid condition value" });
      return;
    }

    if (status && !Object.values(DeviceStatus).includes(status)) {
      res.status(400).json({ message: "Invalid status value" });
      return;
    }

    const nextBrand = brand !== undefined ? brand : existingDevice.brand;
    const nextModel = model !== undefined ? model : existingDevice.model;
    const nextCondition = condition ? (condition as DeviceCondition) : existingDevice.condition;
    const nextBatteryHealth = batteryHealth !== undefined ? Number(batteryHealth) : existingDevice.batteryHealth;
    const { eWasteSavedKg, carbonSavedKg } = calculateSustainabilityMetrics(nextBrand, nextModel);

    const device = await prisma.device.update({
      where: { id },
      data: {
        ...(brand !== undefined ? { brand } : {}),
        ...(model !== undefined ? { model } : {}),
        ...(originalSerialNumber !== undefined ? { originalSerialNumber: originalSerialNumber || null } : {}),
        ...(condition ? { condition: nextCondition } : {}),
        ...(status ? { status: status as DeviceStatus } : {}),
        ...(batteryHealth !== undefined ? { batteryHealth: nextBatteryHealth } : {}),
        ...(repairNotes !== undefined ? { repairNotes } : {}),
        ...(basePrice !== undefined ? { basePrice: Number(basePrice) } : {}),
        ...(price !== undefined ? { price: Number(price) } : {}),
        ...(ownerId !== undefined ? { ownerId: ownerId || null } : {}),
        trustScore: calculateTrustScore(nextCondition, nextBatteryHealth, existingDevice.repairLogs.length),
        eWasteSavedKg,
        carbonSavedKg,
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        passport: true,
        listings: true,
      },
    });

    await writeAuditLog({
      action: "DEVICE_UPDATE",
      details: `User ${req.user?.email} updated device ${device.brand} ${device.model} (${device.id}).`,
      userId: req.user?.id || null,
    });

    res.status(200).json({ message: "Device updated successfully", device });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to update device", error: error.message });
  }
};

export const deleteDevice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "Device id is required" });
      return;
    }

    const existingDevice = await prisma.device.findUnique({ where: { id } });
    if (!existingDevice) {
      res.status(404).json({ message: "Device not found" });
      return;
    }

    await prisma.device.update({
      where: { id },
      data: { status: DeviceStatus.ARCHIVED },
    });
    await prisma.marketplaceListing.updateMany({
      where: { deviceId: id },
      data: { status: ListingStatus.INACTIVE },
    });

    await writeAuditLog({
      action: "DEVICE_DELETE",
      details: `User ${req.user?.email} deleted device ${existingDevice.brand} ${existingDevice.model} (${id}).`,
      userId: req.user?.id || null,
    });

    res.status(200).json({ message: "Device deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to delete device", error: error.message });
  }
};

export const updateRepairStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { deviceId, status, diagnostics, stepsTaken, partsUsed } = req.body;

    if (!deviceId || !status || !diagnostics || !stepsTaken) {
      res.status(400).json({ message: "Required fields: deviceId, status, diagnostics, stepsTaken" });
      return;
    }

    if (status !== DeviceStatus.DIAGNOSTIC && status !== DeviceStatus.REPAIRING) {
      res.status(400).json({ message: "Repair status must be DIAGNOSTIC or REPAIRING" });
      return;
    }

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      res.status(404).json({ message: "Device not found" });
      return;
    }

    const partsString = partsUsed ? JSON.stringify(partsUsed) : "[]";

    const repairLog = await prisma.repairLog.create({
      data: {
        deviceId,
        technicianId: req.user!.id,
        diagnostics,
        stepsTaken,
        partsUsed: partsString,
        status: status as DeviceStatus,
      },
    });

    // Update main device status and notes
    const updatedDevice = await prisma.device.update({
      where: { id: deviceId },
      data: {
        status: status as DeviceStatus,
        repairNotes: diagnostics,
      },
    });

    res.status(200).json({ message: "Repair status updated successfully", repairLog, device: updatedDevice });
  } catch (error: any) {
    res.status(500).json({ message: "Repair update failed", error: error.message });
  }
};

export const submitQcCheck = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { deviceId, checklistPassed } = req.body;

    if (!deviceId || checklistPassed === undefined) {
      res.status(400).json({ message: "Required fields: deviceId, checklistPassed" });
      return;
    }

    if (!checklistPassed) {
      res.status(400).json({ message: "Device must pass all quality control checks to update" });
      return;
    }

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      res.status(404).json({ message: "Device not found" });
      return;
    }

    if (device.status !== DeviceStatus.DIAGNOSTIC && device.status !== DeviceStatus.REPAIRING) {
      res.status(400).json({ message: "Device must be in diagnostics or repair before quality control" });
      return;
    }

    const updatedDevice = await prisma.device.update({
      where: { id: deviceId },
      data: { status: DeviceStatus.QC },
    });

    res.status(200).json({ message: "Device successfully moved to Quality Control (QC) status", device: updatedDevice });
  } catch (error: any) {
    res.status(500).json({ message: "QC submission failed", error: error.message });
  }
};

export const certifyDevice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { deviceId, certificationDetails } = req.body;

    if (!deviceId) {
      res.status(400).json({ message: "Required fields: deviceId" });
      return;
    }

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: { repairLogs: true },
    });
    if (!device) {
      res.status(404).json({ message: "Device not found" });
      return;
    }

    if (device.status !== DeviceStatus.QC) {
      res.status(400).json({ message: "Device must pass quality control before certification" });
      return;
    }

    // Recalculate Trust Score with repair logs accounted for
    const trustScore = calculateTrustScore(device.condition, device.batteryHealth, device.repairLogs.length);

    // Create or Update Digital Passport
    const repairHistoryList = device.repairLogs.map(log => ({
      date: log.createdAt,
      diagnostics: log.diagnostics,
      stepsTaken: log.stepsTaken,
      partsUsed: JSON.parse(log.partsUsed),
    }));

    const batteryHistoryList = [
      { date: device.createdAt, health: device.batteryHealth }
    ];

    const ownershipHistoryList = [
      { date: device.createdAt, owner: "Platform Intake" }
    ];

    const passport = await prisma.devicePassport.upsert({
      where: { deviceId },
      create: {
        deviceId,
        repairHistory: JSON.stringify(repairHistoryList),
        batteryHealthHistory: JSON.stringify(batteryHistoryList),
        ownershipHistory: JSON.stringify(ownershipHistoryList),
        certificationDetails: certificationDetails || "Certified Genuine Refurbished - 100% functional review completed.",
      },
      update: {
        repairHistory: JSON.stringify(repairHistoryList),
        certificationDetails: certificationDetails || "Certified Genuine Refurbished - 100% functional review completed.",
      },
    });

    const updatedDevice = await prisma.device.update({
      where: { id: deviceId },
      data: {
        status: DeviceStatus.READY,
        trustScore,
      },
    });

    await writeAuditLog({
      action: "DEVICE_CERTIFY",
      details: `Technician ${req.user?.email} certified device ${device.brand} ${device.model} (Passport ID: ${passport.id}).`,
      userId: req.user?.id || null,
    });

    res.status(200).json({
      message: "Device certified successfully, digital passport issued",
      device: updatedDevice,
      passport,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Certification failed", error: error.message });
  }
};

export const getDigitalPassport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const deviceId = parseOptionalString(req.params["deviceId"]);

    if (!deviceId) {
      res.status(400).json({ message: "deviceId parameter is required" });
      return;
    }

    const passport = await prisma.devicePassport.findUnique({
      where: { deviceId },
    });

    if (!passport) {
      res.status(404).json({ message: "Digital passport not found for this device" });
      return;
    }

    const device = await prisma.device.findUnique({ where: { id: passport.deviceId } });
    if (!device) {
      res.status(404).json({ message: "Device not found for this passport" });
      return;
    }

    res.status(200).json({
      passport: {
        id: passport.id,
        deviceId: passport.deviceId,
        deviceDetails: {
          brand: device.brand,
          model: device.model,
          condition: device.condition,
          status: device.status,
          batteryHealth: device.batteryHealth,
          trustScore: device.trustScore,
          eWasteSavedKg: device.eWasteSavedKg,
          carbonSavedKg: device.carbonSavedKg,
        },
        repairHistory: JSON.parse(passport.repairHistory),
        batteryHealthHistory: JSON.parse(passport.batteryHealthHistory),
        ownershipHistory: JSON.parse(passport.ownershipHistory),
        certificationDetails: passport.certificationDetails,
        certifiedAt: passport.certifiedAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to retrieve passport", error: error.message });
  }
};

export const submitTradeIn = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { brand, model, condition, batteryHealth } = req.body;

    if (!brand || !model || !condition) {
      res.status(400).json({ message: "Required fields: brand, model, condition" });
      return;
    }

    // Call AI service for estimation
    const evaluation = await AiService.evaluateDevice({
      brand,
      model,
      condition: condition as DeviceCondition,
      batteryHealth: batteryHealth || 85,
    });

    const tradeIn = await prisma.tradeInRequest.create({
      data: {
        userId: req.user!.id,
        brand,
        model,
        condition: condition as DeviceCondition,
        estimatedValue: evaluation.tradeInRecommendation,
        status: TradeInStatus.PENDING,
      },
    });

    res.status(201).json({
      message: "Trade-in request submitted. Instantly evaluated by AI.",
      tradeIn,
      aiEvaluation: evaluation,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Trade-in submission failed", error: error.message });
  }
};

export const listTradeIns = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const isStaff = req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.FINANCE_OFFICER;
    const tradeIns = await prisma.tradeInRequest.findMany({
      where: isStaff ? {} : { userId: req.user!.id },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ tradeIns });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to retrieve trade-in requests", error: error.message });
  }
};

export const getTradeIn = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "Trade-in request id is required" });
      return;
    }

    const tradeIn = await prisma.tradeInRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    if (!tradeIn) {
      res.status(404).json({ message: "Trade-in request not found" });
      return;
    }

    const canView = req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.FINANCE_OFFICER || tradeIn.userId === req.user?.id;
    if (!canView) {
      res.status(403).json({ message: "Forbidden: You can only view your own trade-in requests" });
      return;
    }

    res.status(200).json({ tradeIn });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to retrieve trade-in request", error: error.message });
  }
};

export const reviewTradeIn = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tradeInId = parseOptionalString(req.params["id"]) || req.body.tradeInId;
    const { status } = req.body;

    if (!tradeInId || !status) {
      res.status(400).json({ message: "Required fields: tradeInId, status" });
      return;
    }

    if (!Object.values(TradeInStatus).includes(status)) {
      res.status(400).json({ message: "Invalid status value" });
      return;
    }

    const tradeIn = await prisma.tradeInRequest.findUnique({ where: { id: tradeInId } });
    if (!tradeIn) {
      res.status(404).json({ message: "Trade-in request not found" });
      return;
    }

    if (tradeIn.status === TradeInStatus.COMPLETED) {
      res.status(400).json({ message: "Completed trade-in requests cannot be reviewed again" });
      return;
    }

    const updatedTradeIn = await prisma.tradeInRequest.update({
      where: { id: tradeInId },
      data: { status: status as TradeInStatus },
    });

    // If completed, we can automatically create a device intake
    if (status === "COMPLETED") {
      const { eWasteSavedKg, carbonSavedKg } = calculateSustainabilityMetrics(tradeIn.brand, tradeIn.model);
      await prisma.device.create({
        data: {
          brand: tradeIn.brand,
          model: tradeIn.model,
          condition: tradeIn.condition,
          status: DeviceStatus.INTAKE,
          basePrice: tradeIn.estimatedValue,
          price: tradeIn.estimatedValue * 1.3, // 30% margin markup
          ownerId: null, // Platform owns it now
          trustScore: calculateTrustScore(tradeIn.condition, 85, 0),
          eWasteSavedKg,
          carbonSavedKg,
        }
      });
    }

    res.status(200).json({ message: `Trade-in request marked as ${status}`, tradeIn: updatedTradeIn });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to review trade-in", error: error.message });
  }
};

export const deleteTradeIn = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "Trade-in request id is required" });
      return;
    }

    const tradeIn = await prisma.tradeInRequest.findUnique({ where: { id } });
    if (!tradeIn) {
      res.status(404).json({ message: "Trade-in request not found" });
      return;
    }

    const canDelete = req.user?.role === UserRole.ADMIN || tradeIn.userId === req.user?.id;
    if (!canDelete) {
      res.status(403).json({ message: "Forbidden: You can only delete your own trade-in requests" });
      return;
    }

    await prisma.tradeInRequest.delete({ where: { id } });

    res.status(200).json({ message: "Trade-in request deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to delete trade-in request", error: error.message });
  }
};
