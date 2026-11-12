ALTER TABLE "Trip" ADD COLUMN "promoCode" TEXT, ADD COLUMN "promoDiscount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "customerPayableFare" INTEGER;
ALTER TABLE "Order" ADD COLUMN "promoCode" TEXT, ADD COLUMN "promoDiscount" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "PromoCodeRedemption" (
  "id" TEXT NOT NULL,
  "promoCodeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "serviceScope" TEXT NOT NULL,
  "originalAmount" INTEGER NOT NULL,
  "discountAmount" INTEGER NOT NULL,
  "payableAmount" INTEGER NOT NULL,
  "tripId" TEXT,
  "orderId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoCodeRedemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromoCodeRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PromoCodeRedemption_tripId_key" ON "PromoCodeRedemption"("tripId");
CREATE UNIQUE INDEX "PromoCodeRedemption_orderId_key" ON "PromoCodeRedemption"("orderId");
CREATE INDEX "PromoCodeRedemption_promoCodeId_userId_status_idx" ON "PromoCodeRedemption"("promoCodeId","userId","status");
CREATE INDEX "PromoCodeRedemption_userId_createdAt_idx" ON "PromoCodeRedemption"("userId","createdAt");
