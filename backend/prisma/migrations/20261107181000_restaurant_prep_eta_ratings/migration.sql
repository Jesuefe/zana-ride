ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "preparingAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "readyAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "actualPrepMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "estimatedDeliveryMinutes" INTEGER;

CREATE INDEX IF NOT EXISTS "Order_merchantId_readyAt_idx"
  ON "Order"("merchantId", "readyAt");