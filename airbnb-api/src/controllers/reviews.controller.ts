import type { NextFunction, Request, Response } from "express";
import prisma from "../config/prisma.js";
import { createReviewSchema } from "../validators/review.validator.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { getCache, setCache, deleteCache, deleteCacheByPattern } from "../config/cache.js";

const parseId = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

/**
 * POST /listings/:id/reviews - Add a review to a listing
 */
export const createReview = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const listingId = parseId(req.params.id);

    if (!req.userId) {
      res.status(401).json({ message: "Missing or invalid token" });
      return;
    }
    if (req.role !== "GUEST") {
      res.status(403).json({ message: "Only guests can review listings" });
      return;
    }

    const parsed = createReviewSchema.parse(req.body);
    const { rating, comment } = parsed;

    // Validate rating
    if (rating < 1 || rating > 5) {
      res.status(400).json({ message: "Rating must be between 1 and 5" });
      return;
    }

    // Check if listing exists
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      res.status(404).json({ message: "Listing not found" });
      return;
    }
    if (listing.hostId === req.userId) {
      res.status(403).json({ message: "Hosts cannot review their own listings" });
      return;
    }

    const booking = await prisma.booking.findFirst({
      where: {
        listingId,
        guestId: req.userId,
        status: "CONFIRMED",
      },
    });

    if (!booking) {
      res.status(403).json({ message: "You can only review listings you have booked" });
      return;
    }

    const review = await prisma.review.create({
      data: {
        userId: req.userId,
        listingId,
        rating,
        comment,
      },
      include: {
        user: {
          select: { name: true, avatar: true },
        },
      },
    });

    // Clear cache for this listing's reviews
    deleteCache(`reviews:listing:${listingId}`);
    deleteCache(`ai:summary:${listingId}`);
    deleteCacheByPattern("stats:listings");

    res.status(201).json(review);
  } catch (error) {
    next(error);
  }
};

export const getAllReviews = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        user: { select: { id: true, name: true, avatar: true, email: true } },
        listing: { select: { id: true, title: true, location: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ data: reviews });
  } catch (error) {
    next(error);
  }
};

export const createSystemReview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Missing or invalid token" });
      return;
    }
    const parsed = createReviewSchema.omit({ userId: true }).parse(req.body);
    const review = await prisma.systemReview.create({
      data: { userId: req.userId, rating: parsed.rating, comment: parsed.comment },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
    res.status(201).json(review);
  } catch (error) {
    next(error);
  }
};

export const getSystemReviews = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reviews = await prisma.systemReview.findMany({
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ data: reviews });
  } catch (error) {
    next(error);
  }
};

export const createTestimonial = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Missing or invalid token" });
      return;
    }
    const quote = typeof req.body.quote === "string" ? req.body.quote.trim() : "";
    if (quote.length < 5 || quote.length > 500) {
      res.status(400).json({ message: "Testimonial must be between 5 and 500 characters" });
      return;
    }
    const testimonial = await prisma.testimonial.create({
      data: { userId: req.userId, quote },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
    res.status(201).json(testimonial);
  } catch (error) {
    next(error);
  }
};

export const getTestimonials = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ data: testimonials });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /listings/:id/reviews - Get all reviews for a listing (paginated)
 */
export const getListingReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const listingId = parseId(req.params.id);
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

    // Try to get from cache
    const cacheKey = `reviews:listing:${listingId}:page:${page}:limit:${limit}`;
    const cached = getCache(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    // Check if listing exists
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      res.status(404).json({ message: "Listing not found" });
      return;
    }

    // Fetch reviews and count in parallel
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { listingId },
        include: {
          user: {
            select: { name: true, avatar: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.review.count({ where: { listingId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const response = {
      data: reviews,
      meta: { total, page, limit, totalPages },
    };

    // Cache the response for 30 seconds
    setCache(cacheKey, response, 30);

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /reviews/:id - Delete a review
 */
export const deleteReview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseId(req.params.id);

    const review = await prisma.review.findUnique({ where: { id } });

    if (!review) {
      res.status(404).json({ message: "Review not found" });
      return;
    }

    await prisma.review.delete({ where: { id } });

    // Clear cache for this listing's reviews
    deleteCache(`reviews:listing:${review.listingId}`);
    deleteCache(`ai:summary:${review.listingId}`);
    deleteCacheByPattern("stats:listings");

    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    next(error);
  }
};
