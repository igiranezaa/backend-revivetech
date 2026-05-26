import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../config/prisma.js";
import { DeviceStatus, FinancingStatus, RepaymentStatus } from "@prisma/client";

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // 1. Sales & Revenue
    const orders = await prisma.order.findMany({
      where: { status: "PAID" },
    });
    const totalSalesRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

    // 2. Device Counts
    const totalIntake = await prisma.device.count({ where: { status: DeviceStatus.INTAKE } });
    const totalRepairing = await prisma.device.count({ where: { status: DeviceStatus.REPAIRING } });
    const totalReady = await prisma.device.count({ where: { status: DeviceStatus.READY } });
    const totalSold = await prisma.device.count({ where: { status: DeviceStatus.SOLD } });

    // 3. Financing Stats
    const financingPending = await prisma.financingApplication.count({ where: { status: FinancingStatus.PENDING } });
    const financingApproved = await prisma.financingApplication.count({ where: { status: FinancingStatus.APPROVED } });
    const financingActiveApplications = await prisma.financingApplication.findMany({
      where: { status: FinancingStatus.APPROVED },
      include: { repayments: true },
    });

    let totalRepaymentsExpected = 0;
    let totalRepaymentsCollected = 0;
    let overdueRepaymentsCount = 0;

    financingActiveApplications.forEach(app => {
      app.repayments.forEach(repay => {
        totalRepaymentsExpected += repay.amountDue;
        totalRepaymentsCollected += repay.amountPaid;

        if (repay.status === RepaymentStatus.UNPAID && new Date() > repay.dueDate) {
          overdueRepaymentsCount++;
        }
      });
    });

    res.status(200).json({
      sales: {
        totalOrdersPaid: orders.length,
        totalRevenue: totalSalesRevenue,
      },
      inventory: {
        intakeCount: totalIntake,
        repairingCount: totalRepairing,
        readyForSaleCount: totalReady,
        soldCount: totalSold,
      },
      financing: {
        pendingApplications: financingPending,
        approvedApplications: financingApproved,
        expectedCollections: totalRepaymentsExpected,
        actualCollections: totalRepaymentsCollected,
        overduePayments: overdueRepaymentsCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to get dashboard statistics", error: error.message });
  }
};

export const getSustainabilityReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Sustainability Metrics aggregate
    // Calculated based on devices currently in the platform lifecycle (Intake to Sold)
    const devices = await prisma.device.findMany();

    const totalDevicesRefurbished = devices.filter(d => d.status !== DeviceStatus.TRADE_IN).length;
    const totalEWasteSavedKg = devices.reduce((sum, d) => sum + d.eWasteSavedKg, 0);
    const totalCarbonSavedKg = devices.reduce((sum, d) => sum + d.carbonSavedKg, 0);

    // Dynamic equivalency statistics
    // 1 passenger car emits about 4.6 metric tons (4600 kg) of CO2 per year.
    const equivalentCarDaysSaved = Math.round((totalCarbonSavedKg / (4600 / 365)) * 10) / 10;
    // 1 typical tree absorbs about 22kg CO2 per year.
    const equivalentTreeYearsSaved = Math.round((totalCarbonSavedKg / 22) * 10) / 10;

    res.status(200).json({
      sustainability: {
        devicesProcessedCount: totalDevicesRefurbished,
        totalEWasteSavedKg: Math.round(totalEWasteSavedKg * 100) / 100,
        totalCarbonSavedKg: Math.round(totalCarbonSavedKg * 100) / 100,
        equivalencies: {
          passengerCarDaysOffset: equivalentCarDaysSaved,
          treeAbsorptionYearsOffset: equivalentTreeYearsSaved,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to compile sustainability metrics", error: error.message });
  }
};

export const getInventoryPrediction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Inventory Prediction System
    // Inspects historical sales popularity of specific brands vs active ready stock levels
    const soldDevices = await prisma.device.findMany({
      where: { status: DeviceStatus.SOLD },
    });

    const activeDevices = await prisma.device.findMany({
      where: {
        status: { in: [DeviceStatus.INTAKE, DeviceStatus.DIAGNOSTIC, DeviceStatus.REPAIRING, DeviceStatus.QC, DeviceStatus.READY] },
      },
    });

    // Count sales per brand
    const salesFrequency: Record<string, number> = {};
    soldDevices.forEach(d => {
      const key = `${d.brand} ${d.model}`.toLowerCase();
      salesFrequency[key] = (salesFrequency[key] || 0) + 1;
    });

    // Count current stock per brand
    const stockLevels: Record<string, number> = {};
    activeDevices.forEach(d => {
      const key = `${d.brand} ${d.model}`.toLowerCase();
      stockLevels[key] = (stockLevels[key] || 0) + 1;
    });

    // Generate recommendations
    const predictions: Array<{
      item: string;
      soldCount: number;
      currentStock: number;
      restockPriority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
      reasoning: string;
    }> = [];

    // Evaluate popular items
    Object.keys(salesFrequency).forEach(key => {
      const soldCount = salesFrequency[key] || 0;
      const currentStock = stockLevels[key] || 0;
      const formattedName = key.replace(/(^\w|\s\w)/g, m => m.toUpperCase());

      let restockPriority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
      let reasoning = "";

      if (soldCount > 3 && currentStock === 0) {
        restockPriority = "CRITICAL";
        reasoning = `High customer interest detected. This item has ${soldCount} sales history with zero available replacement units in refurbishment queue.`;
      } else if (soldCount > 1 && currentStock === 0) {
        restockPriority = "HIGH";
        reasoning = `Steady demand indicators. Refurbishment queue is empty. Recommend acquisition.`;
      } else if (soldCount > currentStock * 2) {
        restockPriority = "MEDIUM";
        reasoning = `Sales velocity ($${soldCount} units) is pacing twice as fast as stock availability (${currentStock} units).`;
      } else {
        restockPriority = "LOW";
        reasoning = `Adequate stock covers historic purchase rates.`;
      }

      predictions.push({
        item: formattedName,
        soldCount,
        currentStock,
        restockPriority,
        reasoning,
      });
    });

    // Handle items never sold yet but might be low on stock
    Object.keys(stockLevels).forEach(key => {
      const soldCount = salesFrequency[key] || 0;
      const currentStock = stockLevels[key] || 0;
      const formattedName = key.replace(/(^\w|\s\w)/g, m => m.toUpperCase());

      if (soldCount === 0) {
        predictions.push({
          item: formattedName,
          soldCount: 0,
          currentStock,
          restockPriority: "LOW",
          reasoning: "Fresh inventory profile or low demand. Stock is sufficient.",
        });
      }
    });

    // Sort by priority level
    const priorityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    predictions.sort((a, b) => (priorityWeight[b.restockPriority] || 0) - (priorityWeight[a.restockPriority] || 0));

    res.status(200).json({ predictions });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to generate inventory predictions", error: error.message });
  }
};
