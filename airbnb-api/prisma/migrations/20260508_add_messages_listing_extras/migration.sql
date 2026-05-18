-- Add new columns to Listing
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "placeType" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "spaceType" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "bedrooms" INTEGER;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "beds" INTEGER;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "bathrooms" INTEGER;

-- Create Message table
CREATE TABLE IF NOT EXISTS "Message" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "content"    TEXT NOT NULL,
    "senderId"   TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "bookingId"  TEXT,
    "read"       BOOLEAN NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (safe to re-run)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_senderId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_receiverId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey"
      FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_bookingId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_bookingId_fkey"
      FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "Message_senderId_idx"   ON "Message"("senderId");
CREATE INDEX IF NOT EXISTS "Message_receiverId_idx" ON "Message"("receiverId");
CREATE INDEX IF NOT EXISTS "Message_bookingId_idx"  ON "Message"("bookingId");
