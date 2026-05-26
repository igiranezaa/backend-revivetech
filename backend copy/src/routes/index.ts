import { Router } from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import deviceRoutes from "./device.routes.js";
import marketplaceRoutes from "./marketplace.routes.js";
import paymentRoutes from "./payment.routes.js";
import adminRoutes from "./admin.routes.js";
import aiRoutes from "./ai.routes.js";
import refurbishmentRoutes from "./refurbishment.routes.js";
import sustainabilityJobRoutes from "./sustainability-job.routes.js";
import notificationRoutes from "./notification.routes.js";
import dataRoutes from "./data.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/devices", deviceRoutes);
router.use("/marketplace", marketplaceRoutes);
router.use("/payments", paymentRoutes);
router.use("/admin", adminRoutes);
router.use("/ai", aiRoutes);
router.use("/refurbishments", refurbishmentRoutes);
router.use("/sustainability-jobs", sustainabilityJobRoutes);
router.use("/notifications", notificationRoutes);
router.use("/data", dataRoutes);

export default router;
