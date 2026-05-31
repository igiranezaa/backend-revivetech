import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../config/prisma.js";
import {
  FinancingStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RepaymentStatus,
  TransactionStatus,
  UserRole,
} from "@prisma/client";
import { AiService } from "../services/ai.service.js";
import { writeAuditLog } from "../utils/audit-log.js";
import { parseOptionalString } from "../utils/request.js";

const syncOverdueRepayments = async (): Promise<void> => {
  await prisma.installmentRepayment.updateMany({
    where: { dueDate: { lt: new Date() }, status: RepaymentStatus.UNPAID },
    data: { status: RepaymentStatus.OVERDUE },
  });
};

export const submitFinancing = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { deviceId, monthlyIncome, existingDebts, installmentMonths, creditScore, employmentStatus } = req.body;

    if (!deviceId || monthlyIncome === undefined || existingDebts === undefined || !installmentMonths || !employmentStatus) {
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
    await syncOverdueRepayments();
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
    await syncOverdueRepayments();
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
    const { repaymentId, amount, method = PaymentMethod.MOBILE_MONEY } = req.body;

    if (!repaymentId || !amount || parseFloat(amount) <= 0) {
      res.status(400).json({ message: "Required fields: repaymentId, amount (must be positive)" });
      return;
    }
    if (!Object.values(PaymentMethod).includes(method)) {
      res.status(400).json({ message: `Invalid method. Allowed methods: ${Object.values(PaymentMethod).join(", ")}` });
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

    const isStaff = req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.FINANCE_OFFICER;
    if (!isStaff && repayment.financing.customerId !== req.user?.id) {
      res.status(403).json({ message: "Forbidden: You can only pay your own installments" });
      return;
    }

    if (repayment.status === RepaymentStatus.PAID) {
      res.status(400).json({ message: "Repayment is already fully paid" });
      return;
    }

    const paymentAmount = parseFloat(amount);
    const remainingAmount = repayment.amountDue - repayment.amountPaid;
    if (paymentAmount > remainingAmount) {
      res.status(400).json({ message: `Amount exceeds remaining installment balance of $${remainingAmount.toFixed(2)}` });
      return;
    }

    const newAmountPaid = repayment.amountPaid + paymentAmount;
    const isFullyPaid = newAmountPaid >= repayment.amountDue;

    const updatedRepayment = await prisma.$transaction(async transaction => {
      const updated = await transaction.installmentRepayment.update({
        where: { id: repaymentId },
        data: {
          amountPaid: newAmountPaid,
          status: isFullyPaid
            ? RepaymentStatus.PAID
            : new Date() > repayment.dueDate
              ? RepaymentStatus.OVERDUE
              : RepaymentStatus.UNPAID,
          paidAt: isFullyPaid ? new Date() : null,
        },
      });
      const order = await transaction.order.findFirst({ where: { financingId: repayment.financingId } });
      if (order) {
        await transaction.payment.create({
          data: {
            orderId: order.id,
            userId: repayment.financing.customerId,
            amount: paymentAmount,
            method: method as PaymentMethod,
            status: TransactionStatus.PAID,
            paidAt: new Date(),
          },
        });
      }
      return updated;
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

export const processOrderPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId, amount, method } = req.body;
    const parsedAmount = Number(amount);

    if (!orderId || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !method) {
      res.status(400).json({ message: "Required fields: orderId, amount (positive number), method" });
      return;
    }
    if (!Object.values(PaymentMethod).includes(method)) {
      res.status(400).json({ message: `Invalid method. Allowed methods: ${Object.values(PaymentMethod).join(", ")}` });
      return;
    }

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
    if (!order || order.customerId !== req.user!.id) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    if (order.financingId) {
      res.status(400).json({ message: "Use installment repayments for financed orders" });
      return;
    }

    const paidSoFar = order.payments
      .filter(payment => payment.status === TransactionStatus.PAID)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const balance = Math.round((order.totalAmount - paidSoFar) * 100) / 100;
    if (parsedAmount > balance) {
      res.status(400).json({ message: `Amount exceeds remaining order balance of $${balance.toFixed(2)}` });
      return;
    }

    const isFullyPaid = parsedAmount >= balance;
    const payment = await prisma.$transaction(async transaction => {
      const createdPayment = await transaction.payment.create({
        data: {
          orderId,
          userId: req.user!.id,
          amount: parsedAmount,
          method: method as PaymentMethod,
          status: TransactionStatus.PAID,
          paidAt: new Date(),
        },
      });
      await transaction.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: isFullyPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
          status: isFullyPaid ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
        },
      });
      return createdPayment;
    });

    await writeAuditLog({
      action: "ORDER_PAYMENT",
      details: `User ${req.user?.email} paid $${parsedAmount} toward order ${orderId}.`,
      userId: req.user?.id || null,
    });
    res.status(201).json({ message: isFullyPaid ? "Order paid successfully" : "Partial payment recorded", payment });
  } catch (error: any) {
    res.status(500).json({ message: "Payment processing failed", error: error.message });
  }
};

export const listPayments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const isStaff = req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.FINANCE_OFFICER;
    const payments = await prisma.payment.findMany({
      where: isStaff ? {} : { userId: req.user!.id },
      include: { order: true },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ payments });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to retrieve payment history", error: error.message });
  }
};

export const getPaymentReceipt = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = parseOptionalString(req.params["id"]);
    if (!id) {
      res.status(400).json({ message: "Payment id is required" });
      return;
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        order: { include: { orderItems: { include: { device: true } } } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    const isStaff = req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.FINANCE_OFFICER;
    if (!payment || (!isStaff && payment.userId !== req.user?.id)) {
      res.status(404).json({ message: "Receipt not found" });
      return;
    }

    res.status(200).json({
      receipt: {
        receiptNumber: `RCP-${payment.id.slice(0, 8).toUpperCase()}`,
        issuedAt: payment.paidAt || payment.createdAt,
        payment,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to generate receipt", error: error.message });
  }
};

export const markOverdueRepayments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await syncOverdueRepayments();
    const repayments = await prisma.installmentRepayment.findMany({
      where: { status: RepaymentStatus.OVERDUE },
      include: { financing: true },
      orderBy: { dueDate: "asc" },
    });
    res.status(200).json({ overdueRepayments: repayments });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to sync overdue repayments", error: error.message });
  }
};
