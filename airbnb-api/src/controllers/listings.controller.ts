import type { NextFunction, Request, Response } from "express";
import { ListingType } from "@prisma/client";
import prisma from "../config/prisma.js";
import { createListingSchema, updateListingSchema } from "../validators/listing.validator.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { getCache, setCache, deleteCache, deleteCacheByPattern } from "../config/cache.js";

const parseId = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

/**
 * GET /listings/search - Search listings by location, type, price range, guests
 */
export const searchListings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const location = req.query.location?.toString();
    const type = req.query.type?.toString().toUpperCase();
    const minPriceRaw = req.query.minPrice?.toString();
    const maxPriceRaw = req.query.maxPrice?.toString();
    const guestsRaw = req.query.guests?.toString();
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

    const minPrice = minPriceRaw ? Number.parseFloat(minPriceRaw) : undefined;
    const maxPrice = maxPriceRaw ? Number.parseFloat(maxPriceRaw) : undefined;
    const guests = guestsRaw ? Number.parseInt(guestsRaw, 10) : undefined;

    if (minPriceRaw && Number.isNaN(minPrice)) {
      res.status(400).json({ message: "minPrice must be a number" });
      return;
    }

    if (maxPriceRaw && Number.isNaN(maxPrice)) {
      res.status(400).json({ message: "maxPrice must be a number" });
      return;
    }

    if (guestsRaw && Number.isNaN(guests)) {
      res.status(400).json({ message: "guests must be a number" });
      return;
    }

    if (type && !Object.values(ListingType).includes(type as ListingType)) {
      res.status(400).json({ message: "Invalid listing type" });
      return;
    }

    // Build where clause with conditional filters
    const whereClause: Record<string, unknown> = {
      status: "ACTIVE",
    };

    if (location) {
      whereClause.location = { contains: location, mode: "insensitive" };
    }

    if (type) {
      whereClause.type = type as ListingType;
    }

    if (typeof minPrice === "number") {
      if (!whereClause.pricePerNight) whereClause.pricePerNight = {};
      (whereClause.pricePerNight as Record<string, unknown>).gte = minPrice;
    }

    if (typeof maxPrice === "number") {
      if (!whereClause.pricePerNight) whereClause.pricePerNight = {};
      (whereClause.pricePerNight as Record<string, unknown>).lte = maxPrice;
    }

    if (typeof guests === "number") {
      whereClause.guests = { gte: guests };
    }

    // Fetch listings and count in parallel
    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where: whereClause,
        include: {
          host: {
            select: { name: true, email: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.listing.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: listings,
      meta: { total, page, limit, totalPages },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllListings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try{
    const location = req.query.location?.toString();
    const type = req.query.type?.toString().toUpperCase();
    const maxPriceRaw = req.query.maxPrice?.toString();
    const pageRaw = req.query.page?.toString() ?? "1";
    const limitRaw = req.query.limit?.toString() ?? "10";
    const sortByRaw = req.query.sortBy?.toString() ?? "createdAt";
    const orderRaw = req.query.order?.toString().toLowerCase() ?? "desc";

    const page = Number.parseInt(pageRaw, 10);
    const limit = Number.parseInt(limitRaw, 10);
    if (!Number.isInteger(page) || page <= 0 || !Number.isInteger(limit) || limit <= 0) {
      res.status(400).json({ message: "page and limit must be positive integers" });
      return;
    }

    const maxPrice = maxPriceRaw ? Number.parseFloat(maxPriceRaw) : undefined;
    if (maxPriceRaw && Number.isNaN(maxPrice)) {
      res.status(400).json({ message: "maxPrice must be a number" });
      return;
    }

    if (type && !Object.values(ListingType).includes(type as ListingType)) {
      res.status(400).json({ message: "Invalid listing type" });
      return;
    }

    const allowedSortBy = new Set(["pricePerNight", "createdAt", "rating"]);
     if (!allowedSortBy.has(sortByRaw)) {
       res.status(400).json({ message: "Invalid sortBy field" });
       return;
     }

    if (orderRaw !== "asc" && orderRaw !== "desc") {
     res.status(400).json({ message: "order must be asc or desc" });
     return;
    }

    const whereClause: Record<string, unknown> = {
      status: "ACTIVE",
    };
     if (location) {
      whereClause.location = { contains: location, mode: "insensitive" };
     }
     if (type) {
      whereClause.type = type as ListingType;
     }
     if (typeof maxPrice === "number") {
      whereClause.pricePerNight = { lte: maxPrice };
    }

    const cacheKey = `listings:page:${page}:limit:${limit}:location:${location || ""}:type:${type || ""}:maxPrice:${maxPrice || ""}:sortBy:${sortByRaw}:order:${orderRaw}`;
    const cached = getCache(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const orderByObj: Record<string, "asc" | "desc"> = {};
    orderByObj[sortByRaw] = orderRaw as "asc" | "desc";

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          pricePerNight: true,
          guests: true,
          type: true,
          amenities: true,
          rating: true,
          createdAt: true,
          updatedAt: true,
          hostId: true,
          photos: {
            select: { id: true, url: true },
            take: 5,
          },
          host: {
            select: {
              name: true,
              avatar: true,
            },
          },
          _count: {
            select: { bookings: true, reviews: true },
          },
        },
        orderBy: orderByObj as any,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.listing.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const response = {
      data: listings,
      meta: { total, page, limit, totalPages },
    };

    setCache(cacheKey, response, 60);

    res.json(response);
  }
  catch(error){
    next(error);
  }
};

export const getListingById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try{
    const id = parseId(req.params.id);

      const listing = await prisma.listing.findUnique({
        where: { id },
        include: {
          host: true,
          bookings: {
            include: {
              guest: {
                select: { name: true, avatar: true },
              },
            },
          },
          reviews: {
            include: {
              user: { select: { id: true, name: true, avatar: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!listing) {
        res.status(404).json({ message: "Listing not found" });
        return;
     }

    res.json(listing);
  }catch(error){
    next(error);
  }
};

export const createListing = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try{
    const parsed = createListingSchema.parse(req.body);
    const { title, description, location, pricePerNight, guests, type, amenities, rating } = parsed;

  if (!req.userId) {
    res.status(401).json({ message: "Missing or invalid token" });
    return;
  }

  const listing = await prisma.listing.create({
    data: {
      title,
      description,
      location,
      pricePerNight,
      guests,
      type: type as ListingType,
      status: req.role === "GUEST" ? "PENDING" : "ACTIVE",
      amenities,
      rating: typeof rating === "number" ? rating : null,
      hostId: req.userId,
    },
  });

  // Invalidate stats and listings cache
  deleteCacheByPattern("stats:");
  deleteCacheByPattern("listings:");

  res.status(201).json(listing);
  }catch(error){
      next(error);
  }
};

export const updateListing = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseId(req.params.id);


  const current = await prisma.listing.findFirst({ where: { id } });
  if (!current) {
    res.status(404).json({ message: "Listing not found" });
    return;
  }

  if (!req.userId) {
    res.status(401).json({ message: "Missing or invalid token" });
    return;
  }
  if (current.hostId !== req.userId && req.role !== "ADMIN") {
    res.status(403).json({ message: "You can only edit your own listings" });
    return;
  }

  const parsed = updateListingSchema.parse(req.body);
  const payload = {
    ...parsed,
    rating: typeof parsed.rating === "number" ? parsed.rating : undefined,
  } as Record<string, unknown>;

  const listing = await prisma.listing.update({
    where: { id },
    data: payload,
  });

  // Invalidate stats and listings cache
  deleteCacheByPattern("stats:");
  deleteCacheByPattern("listings:");

  res.json(listing);
  } catch (error) {
    next(error);
  }
};

export const deleteListing = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseId(req.params.id);

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      res.status(404).json({ message: "Listing not found" });
      return;
    }

    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Only the host or an admin can expire a listing
    if (listing.hostId !== req.userId && req.role !== "ADMIN") {
      res.status(403).json({ message: "You can only remove your own listings" });
      return;
    }

    // Soft delete: set status to EXPIRED instead of deleting from DB
    const updated = await prisma.listing.update({
      where: { id },
      data: { status: "EXPIRED" },
    });

    res.json({ message: "Listing marked as expired", listing: updated });
  } catch (error) {
    next(error);
  }
};

export const getAdminListings = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const statusRaw = req.query.status?.toString().toUpperCase();
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

    const whereClause: Record<string, unknown> = {};
    if (statusRaw && ["ACTIVE", "PENDING", "EXPIRED"].includes(statusRaw)) {
      whereClause.status = statusRaw;
    }

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          location: true,
          pricePerNight: true,
          rating: true,
          createdAt: true,
          hostId: true,
          status: true,
          guests: true,
          type: true,
          amenities: true,
          description: true,
          photos: {
            select: { id: true, url: true },
            take: 1,
          },
          host: {
            select: {
              name: true,
            },
          },
          _count: {
            select: { bookings: true, reviews: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.listing.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: listings,
      meta: { total, page, limit, totalPages },
    });
  } catch (error) {
    next(error);
  }
};

