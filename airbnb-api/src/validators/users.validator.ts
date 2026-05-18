import { z } from "zod/v4";

export const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  phone: z.string().min(7, "Invalid phone number"),
  role: z.enum(["ADMIN", "HOST", "GUEST"]).default("GUEST"),
  isSuperAdmin: z.boolean().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const updateUserSchema = createUserSchema.partial();
