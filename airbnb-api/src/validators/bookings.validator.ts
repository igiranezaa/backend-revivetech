import { z } from "zod/v4";

export const createBookingSchema = z.object({
  listingId: z.string().uuid("Listing ID must be a valid UUID"),
  checkIn: z.string().datetime("Invalid checkIn date"),
  checkOut: z.string().datetime("Invalid checkOut date"),
  guests: z.number().int().positive("Guests must be a positive integer"),
}).refine(
  (data) => new Date(data.checkIn) < new Date(data.checkOut),
  { message: "checkIn must be before checkOut", path: ["checkIn"] }
).refine(
  (data) => new Date(data.checkIn) > new Date(),
  { message: "checkIn must be in the future", path: ["checkIn"] }
);
