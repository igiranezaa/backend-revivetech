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
import {
  addCartItem,
  addWishlistItem,
  clearCart,
  compareDevices,
  getCart,
  getOrder,
  listOrders,
  listWishlist,
  removeCartItem,
  removeWishlistItem,
} from "../controller/storefront.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { UserRole } from "@prisma/client";

const router = Router();

// Publicly browse listings
router.get("/", getListings);
router.get("/compare", compareDevices);
router.get("/cart", requireAuth, getCart);
router.post("/cart", requireAuth, addCartItem);
router.delete("/cart", requireAuth, clearCart);
router.delete("/cart/:deviceId", requireAuth, removeCartItem);
router.get("/wishlist", requireAuth, listWishlist);
router.post("/wishlist", requireAuth, addWishlistItem);
router.delete("/wishlist/:deviceId", requireAuth, removeWishlistItem);
router.get("/orders", requireAuth, listOrders);
router.get("/orders/:id", requireAuth, getOrder);
router.get("/:id", getListingDetails);

// Admin-managed listing creation & optimization
router.post("/", requireAuth, requireRoles([UserRole.ADMIN]), createListing);
router.post("/smart-pricing", requireAuth, requireRoles([UserRole.ADMIN]), triggerSmartPricing);
router.put("/:id", requireAuth, requireRoles([UserRole.ADMIN]), updateListing);
router.delete("/:id", requireAuth, requireRoles([UserRole.ADMIN]), deleteListing);

// Checkout route (customer only)
router.post("/checkout", requireAuth, checkout);

export default router;
