import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../config/prisma.js";
import { FinancingStatus, RepaymentStatus, UserRole } from "@prisma/client";
import { AiService } from "../services/ai.service.js";
import { writeAuditLog } from "../utils/audit-log.js";
import { parseOptionalString } from "../utils/request.js";

export const submitFinancing = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { deviceId, monthlyIncome, existingDebts, installmentMonths, creditScore, employmentStatus } = req.body;

    if (!deviceId || !monthlyIncome || !existingDebts || !installmentMonths || !employmentStatus) {
      res.status(400).json({
        message: "Required fields: deviceId, monthlyIncome, existingDebts, installmentMonths, employmentStatus",
      });
      return;
    }

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      res.status(404).json({ message: "Device not found" });
      return;
    }

    // Call AI financing assessment
    const aiEvaluation = await AiService.evaluateFinancing({
      monthlyIncome: parseFloat(monthlyIncome),
      existingDebts: parseFloat(existingDebts),
      requestedAmount: device.price,
      employmentStatus,
      ...(creditScore ? { creditScore: parseInt(creditScore) } : {}),
    });

    const interestRate = 0.12; // 12% flat rate
    const totalFinanced = device.price * (1 + interestRate);
    const monthlyRepayment = totalFinanced / parseInt(installmentMonths);

    const financingApp = await prisma.financingApplication.create({
      data: {
        customerId: req.user!.id,
        deviceId,
        status: FinancingStatus.PENDING,
        totalAmount: device.price,
        interestRate,
        installmentMonths: parseInt(installmentMonths),
        monthlyRepayment: Math.round(monthlyRepayment * 100) / 100,
        riskSummary: aiEvaluation.riskSummary,
        fraudFlags: aiEvaluation.fraudFlagHints.join(", "),
        paymentAbilityScore: aiEvaluation.paymentAbilityScore,
        officerRecommendation: aiEvaluation.installmentRecommendation,
      },
    });

    res.status(201).json({
      message: "Financing application submitted successfully. Pending Finance Officer approval.",
      application: financingApp,
      aiRecommendation: aiEvaluation,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to submit financing application", error: error.message });
  }
};

export const listFinancingApplications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, customerId, deviceId } = req.query;
    const isStaff = req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.FINANCE_OFFICER;

    const where: any = {
      ...(isStaff ? {} : { customerId: req.user!.id }),
      ...(customerId && isStaff ? { customerId: customerId as string } : {}),
      ...(deviceId ? { deviceId: deviceId as string } : {}),
    };

    if (status && Object.values(FinancingStatus).includes(status as FinancingStatus)) {
      where.status = status as FinancingStatus;
    }

    const applications = await prisma.financingApplication.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        device: true,
        repayments: { orderBy: { dueDate: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ applications });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to list financing applications", error: error.message });
  }
};

export const getFinancingDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);

    if (!id) {
      res.status(400).json({ message: "Financing application id is required" });
      return;
    }

    const application = await prisma.financingApplication.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        device: true,
        repayments: {
          orderBy: { dueDate: "asc" },
        },
      },
    });

    if (!application) {
      res.status(404).json({ message: "Financing application not found" });
      return;
    }

    const isStaff = req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.FINANCE_OFFICER;
    if (!isStaff && application.customerId !== req.user?.id) {
      res.status(403).json({ message: "Forbidden: You can only view your own financing applications" });
      return;
    }

    res.status(200).json({ application });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to retrieve financing details", error: error.message });
  }
};

export const updateFinancingApplication = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "Financing application id is required" });
      return;
    }

    const {
      status,
      installmentMonths,
      monthlyRepayment,
      riskSummary,
      fraudFlags,
      paymentAbilityScore,
      officerRecommendation,
      approvedById,
    } = req.body;

    if (status && !Object.values(FinancingStatus).includes(status)) {
      res.status(400).json({ message: "Invalid financing status value" });
      return;
    }

    const existing = await prisma.financingApplication.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: "Financing application not found" });
      return;
    }

    const application = await prisma.financingApplication.update({
      where: { id },
      data: {
        ...(status ? { status: status as FinancingStatus } : {}),
        ...(installmentMonths !== undefined ? { installmentMonths: Number(installmentMonths) } : {}),
        ...(monthlyRepayment !== undefined ? { monthlyRepayment: Number(monthlyRepayment) } : {}),
        ...(riskSummary !== undefined ? { riskSummary } : {}),
        ...(fraudFlags !== undefined ? { fraudFlags } : {}),
        ...(paymentAbilityScore !== undefined ? { paymentAbilityScore: Number(paymentAbilityScore) } : {}),
        ...(officerRecommendation !== undefined ? { officerRecommendation } : {}),
        ...(approvedById !== undefined ? { approvedById: approvedById || null } : {}),
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        device: true,
        repayments: { orderBy: { dueDate: "asc" } },
      },
    });

    await writeAuditLog({
      action: "FINANCING_UPDATE",
      details: `Financing application ${id} updated by ${req.user?.email}.`,
      userId: req.user?.id || null,
    });

    res.status(200).json({ message: "Financing application updated successfully", application });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to update financing application", error: error.message });
  }
};

export const deleteFinancingApplication = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "Financing application id is required" });
      return;
    }

    const existing = await prisma.financingApplication.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: "Financing application not found" });
      return;
    }

    await prisma.financingApplication.delete({ where: { id } });

    await writeAuditLog({
      action: "FINANCING_DELETE",
      details: `Financing application ${id} deleted by ${req.user?.email}.`,
      userId: req.user?.id || null,
    });

    res.status(200).json({ message: "Financing application deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to delete financing application", error: error.message });
  }
};

export const officerReviewFinancing = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { applicationId, status } = req.body;

    if (!applicationId || !status) {
      res.status(400).json({ message: "Required fields: applicationId, status" });
      return;
    }

    if (status !== FinancingStatus.APPROVED && status !== FinancingStatus.REJECTED) {
      res.status(400).json({ message: "Invalid status. Must be APPROVED or REJECTED" });
      return;
    }

    const application = await prisma.financingApplication.findUnique({
      where: { id: applicationId },
      include: { repayments: true },
    });

    if (!application) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    if (application.status !== FinancingStatus.PENDING) {
      res.status(400).json({ message: `Application has already been reviewed (Status: ${application.status})` });
      return;
    }

    const updatedApp = await prisma.financingApplication.update({
      where: { id: applicationId },
      data: {
        status: status as FinancingStatus,
        approvedById: req.user!.id,
      },
    });

    // Generate Repayment Schedule if approved
    if (status === FinancingStatus.APPROVED) {
      const repaymentRows = [];
      const now = new Date();

      for (let i = 1; i <= application.installmentMonths; i++) {
        const dueDate = new Date();
        dueDate.setMonth(now.getMonth() + i);

        repaymentRows.push({
          financingId: applicationId,
          dueDate,
          amountDue: application.monthlyRepayment,
          amountPaid: 0.0,
          status: RepaymentStatus.UNPAID,
        });
      }

      await prisma.installmentRepayment.createMany({
        data: repaymentRows,
      });
    }

    await writeAuditLog({
      action: "FINANCING_REVIEW",
      details: `Finance Officer ${req.user?.email} reviewed application ${applicationId} and marked it as ${status}.`,
      userId: req.user?.id || null,
    });

    res.status(200).json({
      message: `Financing application ${status.toLowerCase()} successfully`,
      application: updatedApp,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to review financing application", error: error.message });
  }
};

export const makeRepayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { repaymentId, amount } = req.body;

    if (!repaymentId || !amount || parseFloat(amount) <= 0) {
      res.status(400).json({ message: "Required fields: repaymentId, amount (must be positive)" });
      return;
    }

    const repayment = await prisma.installmentRepayment.findUnique({
      where: { id: repaymentId },
      include: { financing: true },
    });

    if (!repayment) {
      res.status(404).json({ message: "Repayment entry not found" });
      return;
    }

    if (repayment.status === RepaymentStatus.PAID) {
      res.status(400).json({ message: "Repayment is already fully paid" });
      return;
    }

    const newAmountPaid = repayment.amountPaid + parseFloat(amount);
    const isFullyPaid = newAmountPaid >= repayment.amountDue;

    const updatedRepayment = await prisma.installmentRepayment.update({
      where: { id: repaymentId },
      data: {
        amountPaid: newAmountPaid,
        status: isFullyPaid ? RepaymentStatus.PAID : RepaymentStatus.UNPAID,
        paidAt: isFullyPaid ? new Date() : null,
      },
    });

    // Check if overdue logs need updating
    // If today is past due date and it was unpaid, but is now paid, it fixes it
    await writeAuditLog({
      action: "REPAYMENT_MADE",
      details: `User made repayment of $${amount} for installment ${repaymentId}. Status: ${updatedRepayment.status}.`,
      userId: req.user?.id || null,
    });

    res.status(200).json({
      message: isFullyPaid ? "Installment paid in full!" : `Repayment processed. Remaining due: $${Math.round((repayment.amountDue - newAmountPaid) * 100) / 100}`,
      repayment: updatedRepayment,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Repayment processing failed", error: error.message });
  }
};
