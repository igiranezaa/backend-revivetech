-- Add roles array to User (stores multiple roles like GUEST+HOST)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roles" "Role"[] NOT NULL DEFAULT ARRAY['GUEST'::"Role"];

-- Backfill: copy existing role into roles array
UPDATE "User" SET "roles" = ARRAY["role"::"Role"] WHERE array_length("roles", 1) = 1 AND "roles" = ARRAY['GUEST'::"Role"];
