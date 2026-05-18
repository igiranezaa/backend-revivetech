import { Router } from "express";
import {
  createBooking,
  deleteBooking,
  getAllBookings,
  getBookingById,
  getUserBookings,
  approveBooking,
  getMyBookings,
  getHostBookings,
} from "../../controllers/bookings.controller.js";
import { authenticate, requireAdmin } from "../../middlewares/auth.middleware.js";

const router = Router();

// ── Admin: all bookings across the platform ──
// Must be before /:id to avoid route conflict
router.get("/admin", authenticate, requireAdmin, getAllBookings);

router.get("/my",   authenticate, getMyBookings);
router.get("/host", authenticate, getHostBookings);
router.get("/:id",  getBookingById);
router.post("/",    authenticate, createBooking);
router.patch("/:id/approve", authenticate, approveBooking);
router.delete("/:id",        authenticate, deleteBooking);

export default router;