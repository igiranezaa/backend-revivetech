import type { NextFunction, Request, Response } from "express";
import { BookingStatus } from "@prisma/client";
import prisma from "../config/prisma.js";
import { createBookingSchema } from "../validators/bookings.validator.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { sendEmail } from "../config/email.js";
import { bookingConfirmationEmail, bookingCancellationEmail } from "../templates/emails.js";

const parseId = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

const adminNotificationRecipients = (): string[] => {
  const configured = process.env["ADMIN_NOTIFICATION_EMAILS"] || process.env["ADMIN_EMAIL"] || "fifingabire25@gmail.com";
  return configured.split(",").map((email) => email.trim()).filter(Boolean);
};

const notifyAdmins = (subject: string, html: string): void => {
  adminNotificationRecipients().forEach((email) => {
    sendEmail(email, subject, html).catch((err) => console.error(`Failed to send admin email to ${email}:`, err));
  });
};

export const getAllBookings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pageRaw = req.query.page?.toString() ?? "1";
    const limitRaw = req.query.limit?.toString() ?? "10";

    const page = Number.parseInt(pageRaw, 10);
    const limit = Number.parseInt(limitRaw, 10);

    if (
      !Number.isInteger(page) ||
      page <= 0 ||
      !Number.isInteger(limit) ||
      limit <= 0
    ) {
      res.status(400).json({ message: "page and limit must be positive integers" });
      return;
    }

    // Fetch bookings and count in parallel
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        include: {
          guest: {
            select: { name: true },
          },
          listing: {
            select: { title: true, location: true, host: { select: { name: true } } },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.booking.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: bookings,
      meta: { total, page, limit, totalPages },
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseId(req.params.id);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        guest: true,
        listing: {
          include: {
            host: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!booking) {
      res.status(404).json({ message: "Booking not found" });
      return;
    }

    res.json(booking);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /users/:id/bookings - Get all bookings for a user (paginated)
 */
export const getUserBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = parseId(req.params.id);
    const pageRaw = req.query.page?.toString() ?? "1";
    const limitRaw = req.query.limit?.toString() ?? "10";

    const page = Number.parseInt(pageRaw, 10);
    const limit = Number.parseInt(limitRaw, 10);

    if (
      !Number.isInteger(page) ||
      page <= 0 ||
      !Number.isInteger(limit) ||
      limit <= 0
    ) {
      res.status(400).json({ message: "page and limit must be positive integers" });
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Fetch bookings and count in parallel
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where: { guestId: userId },
        include: {
          listing: {
            select: { id: true, title: true, location: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.booking.count({ where: { guestId: userId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: bookings,
      meta: { total, page, limit, totalPages },
    });
  } catch (error) {
    next(error);
  }
};

export const createBooking = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Missing or invalid token" });
      return;
    }

    const parsed = createBookingSchema.parse(req.body);
    const { listingId, checkIn, checkOut, guests } = parsed;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      res.status(404).json({ message: "Listing not found" });
      return;
    }

    if (listing.hostId === req.userId) {
      res.status(403).json({ message: "Hosts cannot book their own listings" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const conflict = await prisma.booking.findFirst({
      where: {
        listingId,
        status: BookingStatus.CONFIRMED,
        checkIn: { lt: checkOutDate },
        checkOut: { gt: checkInDate },
      },
    });
    if (conflict) {
      res.status(409).json({ message: "Booking conflict for these dates" });
      return;
    }

    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const numberOfDays = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / millisecondsPerDay);
    const totalPrice = numberOfDays * listing.pricePerNight;

    const booking = await prisma.booking.create({
      data: {
        guestId: req.userId,
        listingId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests,
        totalPrice,
        status: BookingStatus.PENDING,
      },
      include: {
        guest: {
          select: { name: true, email: true },
        },
        listing: {
          select: { title: true, location: true, host: { select: { email: true, name: true } } },
        },
      },
    });

    res.status(201).json(booking);

    // Send confirmation email (non-blocking)
    sendEmail(
      user.email,
      "Booking Confirmation",
      bookingConfirmationEmail(
        user.name,
        listing.title,
        listing.location,
        checkInDate.toDateString(),
        checkOutDate.toDateString(),
        totalPrice
      )
    ).catch((err) => console.error("Failed to send booking confirmation email:", err));

    if (booking.listing.host.email) {
      sendEmail(
        booking.listing.host.email,
        "New booking request",
        `<p>Hi ${booking.listing.host.name}, ${user.name} requested to book <strong>${listing.title}</strong> from ${checkInDate.toDateString()} to ${checkOutDate.toDateString()}.</p>`
      ).catch((err) => console.error("Failed to send host booking email:", err));
    }

    notifyAdmins(
      "New booking request",
      `<p>${user.name} (${user.email}) booked <strong>${listing.title}</strong> in ${listing.location} from ${checkInDate.toDateString()} to ${checkOutDate.toDateString()}.</p>`
    );
  } catch (error) {
    next(error);
  }
};

export const updateBookingStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseId(req.params.id);

    const status = req.body.status?.toString()?.toUpperCase();
    if (!Object.values(BookingStatus).includes(status as BookingStatus)) {
      res.status(400).json({ message: "Invalid booking status" });
      return;
    }

    const existing = await prisma.booking.findFirst({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: "Booking not found" });
      return;
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        status: status as BookingStatus,
      },
    });

    res.json(booking);
  } catch (error) {
    next(error);
  }
};

export const deleteBooking = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseId(req.params.id);

    const existing = await prisma.booking.findFirst({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: "Booking not found" });
      return;
    }

    if (!req.userId) {
      res.status(401).json({ message: "Missing or invalid token" });
      return;
    }
    if (existing.guestId !== req.userId && req.role !== "ADMIN") {
      res.status(403).json({ message: "You can only cancel your own bookings" });
      return;
    }
    if (existing.status === BookingStatus.CANCELLED) {
      res.status(400).json({ message: "Booking is already cancelled" });
      return;
    }

    const cancelled = await prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });

    res.status(200).json({ message: "Booking cancelled successfully" });

    // Send cancellation email (non-blocking)
    const bookingWithDetails = await prisma.booking.findUnique({
      where: { id },
      include: {
        guest: { select: { email: true, name: true } },
        listing: { select: { title: true } },
      },
    });

    if (bookingWithDetails) {
      sendEmail(
        bookingWithDetails.guest.email,
        "Booking Cancelled",
        bookingCancellationEmail(
          bookingWithDetails.guest.name,
          bookingWithDetails.listing.title,
          bookingWithDetails.checkIn.toDateString(),
          bookingWithDetails.checkOut.toDateString()
        )
      ).catch((err) => console.error("Failed to send booking cancellation email:", err));
    }
  }
  catch (error) {
    next(error);
  }
};

/** PATCH /bookings/:id/approve — host approves a pending booking */
export const approveBooking = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const id = parseId(req.params.id);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        listing: { select: { hostId: true, title: true, location: true } },
        guest: { select: { email: true, name: true } },
      },
    });
    if (!booking) { res.status(404).json({ message: "Booking not found" }); return; }
    if (booking.listing.hostId !== req.userId) {
      res.status(403).json({ message: "Only the host can approve this booking" }); return;
    }
    if (booking.status !== BookingStatus.PENDING) {
      res.status(400).json({ message: `Booking is already ${booking.status.toLowerCase()}` }); return;
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CONFIRMED },
    });

    res.json(updated);

    if (booking.guest.email) {
      sendEmail(
        booking.guest.email,
        "Booking Confirmed",
        bookingConfirmationEmail(
          booking.guest.name,
          booking.listing.title,
          booking.listing.location,
          booking.checkIn.toDateString(),
          booking.checkOut.toDateString(),
          booking.totalPrice
        )
      ).catch((err) => console.error("Failed to send booking confirmation email:", err));
    } else {
      console.warn(`Booking ${id} approved but guest has no email address.`);
    }
  } catch (err) { next(err); }
};

/** GET /bookings/my — get current user's bookings (as guest) */
export const getMyBookings = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const bookings = await prisma.booking.findMany({
      where: { guestId: req.userId },
      include: {
        listing: {
          select: { id: true, title: true, location: true, pricePerNight: true, photos: { take: 1 } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(bookings);
  } catch (err) { next(err); }
};

/** GET /bookings/host — get bookings for listings owned by current user (as host) */
export const getHostBookings = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const bookings = await prisma.booking.findMany({
      where: { listing: { hostId: req.userId } },
      include: {
        guest: { select: { id: true, name: true, email: true, avatar: true } },
        listing: { select: { id: true, title: true, location: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(bookings);
  } catch (err) { next(err); }
};
