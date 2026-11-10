-- Add private business-registration certificate references to merchant profiles.
ALTER TABLE "Merchant"
  ADD COLUMN IF NOT EXISTS "businessCertificateUrl" TEXT;

-- Align already-delivered package photos with the 30-day retention policy.
UPDATE "Delivery"
SET "imageDeleteAfter" = COALESCE("deliveredAt", "createdAt") + INTERVAL '30 days'
WHERE "imageUrl" IS NOT NULL
  AND "status" = 'DELIVERED';