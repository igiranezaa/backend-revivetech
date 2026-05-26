import { Router } from "express";
import {
  deleteListing,
  getListings,
  getListingDetails,
  createListing,
  triggerSmartPricing,
  checkout,
  updateListing,
} from "../controller/marketplace.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { UserRole } from "@prisma/client";

const router = Router();

// Publicly browse listings
router.get("/", getListings);
router.get("/:id", getListingDetails);

// Admin-managed listing creation & optimization
router.post("/", requireAuth, requireRoles([UserRole.ADMIN]), createListing);
router.post("/smart-pricing", requireAuth, requireRoles([UserRole.ADMIN]), triggerSmartPricing);
router.put("/:id", requireAuth, requireRoles([UserRole.ADMIN]), updateListing);
router.delete("/:id", requireAuth, requireRoles([UserRole.ADMIN]), deleteListing);

// Checkout route (customer only)
router.post("/checkout", requireAuth, checkout);

export default router;
