import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../config/prisma.js";
import { parseOptionalString } from "../utils/request.js";

type ModelKey =
  | "users"
  | "devices"
  | "device-passports"
  | "repair-logs"
  | "marketplace-listings"
  | "financing-applications"
  | "installment-repayments"
  | "orders"
  | "order-items"
  | "trade-in-requests"
  | "support-chat-sessions"
  | "support-chat-messages"
  | "trust-scores"
  | "refurbishments"
  | "ai-interactions"
  | "sustainability-jobs"
  | "carts"
  | "cart-items"
  | "wishlists"
  | "payments"
  | "notifications"
  | "system-logs";

const modelReaders: Record<ModelKey, any> = {
  users: prisma.user,
  devices: prisma.device,
  "device-passports": prisma.devicePassport,
  "repair-logs": prisma.repairLog,
  "marketplace-listings": prisma.marketplaceListing,
  "financing-applications": prisma.financingApplication,
  "installment-repayments": prisma.installmentRepayment,
  orders: prisma.order,
  "order-items": prisma.orderItem,
  "trade-in-requests": prisma.tradeInRequest,
  "support-chat-sessions": prisma.supportChatSession,
  "support-chat-messages": prisma.supportChatMessage,
  "trust-scores": prisma.trustScore,
  refurbishments: prisma.refurbishment,
  "ai-interactions": prisma.aiInteraction,
  "sustainability-jobs": prisma.sustainabilityJob,
  carts: prisma.cart,
  "cart-items": prisma.cartItem,
  wishlists: prisma.wishlist,
  payments: prisma.payment,
  notifications: prisma.notification,
  "system-logs": prisma.systemLog,
};

const safeUserSelect = {
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
};

const modelIncludes: Partial<Record<ModelKey, object>> = {
  devices: {
    owner: { select: safeUserSelect },
    repairLogs: true,
    passport: true,
    listings: true,
    orderItems: true,
    financingApplications: true,
    refurbishments: true,
    sustainabilityJobs: true,
  },
  "device-passports": { device: true },
  "repair-logs": { device: true, technician: { select: safeUserSelect } },
  "marketplace-listings": { device: true },
  "financing-applications": {
    customer: { select: safeUserSelect },
    device: true,
    approvedBy: { select: safeUserSelect },
    repayments: true,
    orders: true,
  },
  "installment-repayments": { financing: true },
  orders: { customer: { select: safeUserSelect }, financing: true, orderItems: true, payments: true },
  "order-items": { order: true, device: true },
  "trade-in-requests": { user: { select: safeUserSelect } },
  "support-chat-sessions": { customer: { select: safeUserSelect }, messages: true, aiInteractions: true },
  "support-chat-messages": { session: true },
  "trust-scores": { device: true },
  refurbishments: { device: true, technician: { select: safeUserSelect } },
  "ai-interactions": { user: { select: safeUserSelect }, session: true },
  "sustainability-jobs": { device: true, assignedTo: { select: safeUserSelect } },
  carts: { user: { select: safeUserSelect }, items: true },
  "cart-items": { cart: true, device: true },
  wishlists: { user: { select: safeUserSelect }, device: true },
  payments: { order: true, user: { select: safeUserSelect } },
  notifications: { user: { select: safeUserSelect } },
  "system-logs": { user: { select: safeUserSelect } },
};

const modelSelects: Partial<Record<ModelKey, object>> = {
  users: {
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
    notifications: true,
  },
};

const modelsWithCreatedAt = new Set<ModelKey>([
  "users",
  "devices",
  "device-passports",
  "repair-logs",
  "marketplace-listings",
  "financing-applications",
  "installment-repayments",
  "orders",
  "trade-in-requests",
  "support-chat-sessions",
  "support-chat-messages",
  "trust-scores",
  "refurbishments",
  "ai-interactions",
  "sustainability-jobs",
  "carts",
  "cart-items",
  "wishlists",
  "payments",
  "notifications",
  "system-logs",
]);

const parsePositiveInteger = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getModelKey = (req: AuthenticatedRequest): ModelKey | undefined => {
  const model = parseOptionalString(req.params["model"]);
  return model && model in modelReaders ? (model as ModelKey) : undefined;
};

export const listDataModels = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.status(200).json({
    models: Object.keys(modelReaders),
  });
};

export const getAllModelRecords = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const model = getModelKey(req);
    if (!model) {
      res.status(404).json({ message: "Model not found", availableModels: Object.keys(modelReaders) });
      return;
    }

    const page = parsePositiveInteger(req.query["page"], 1);
    const limit = Math.min(parsePositiveInteger(req.query["limit"], 50), 200);
    const skip = (page - 1) * limit;
    const delegate = modelReaders[model];
    const include = modelIncludes[model];
    const select = modelSelects[model];

    const [records, total] = await Promise.all([
      delegate.findMany({
        ...(select ? { select } : {}),
        ...(include ? { include } : {}),
        skip,
        take: limit,
        ...(modelsWithCreatedAt.has(model) ? { orderBy: { createdAt: "desc" } } : {}),
      }),
      delegate.count(),
    ]);

    res.status(200).json({
      model,
      page,
      limit,
      total,
      records,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to list model records", error: error.message });
  }
};

export const getModelRecordById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const model = getModelKey(req);
    const id = parseOptionalString(req.params["id"]);
    if (!model) {
      res.status(404).json({ message: "Model not found", availableModels: Object.keys(modelReaders) });
      return;
    }

    if (!id) {
      res.status(400).json({ message: "Record id is required" });
      return;
    }

    const record = await modelReaders[model].findUnique({
      where: { id },
      ...(modelSelects[model] ? { select: modelSelects[model] } : {}),
      ...(modelIncludes[model] ? { include: modelIncludes[model] } : {}),
    });

    if (!record) {
      res.status(404).json({ message: "Record not found" });
      return;
    }

    res.status(200).json({ model, record });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to get model record", error: error.message });
  }
};
