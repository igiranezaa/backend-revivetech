import { z } from "zod/v4";

export const createReviewSchema = z.object({
  userId: z.string().uuid("User ID must be a valid UUID").optional(),
  rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
  comment: z.string().min(1, "Comment is required").max(1000, "Comment must not exceed 1000 characters"),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
