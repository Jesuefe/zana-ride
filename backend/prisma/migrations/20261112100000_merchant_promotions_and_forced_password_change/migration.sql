ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Merchant" ADD COLUMN "promoExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Merchant" ADD COLUMN "promoExemptionReason" TEXT;
CREATE TABLE "MerchantPromotion" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "comboPrice" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantPromotion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantPromotion_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "MerchantPromotionItem" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  CONSTRAINT "MerchantPromotionItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantPromotionItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "MerchantPromotion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MerchantPromotionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MerchantPromotion_merchantId_startsAt_endsAt_idx" ON "MerchantPromotion"("merchantId","startsAt","endsAt");
CREATE INDEX "MerchantPromotion_status_startsAt_endsAt_idx" ON "MerchantPromotion"("status","startsAt","endsAt");
CREATE UNIQUE INDEX "MerchantPromotionItem_promotionId_productId_key" ON "MerchantPromotionItem"("promotionId","productId");
CREATE INDEX "MerchantPromotionItem_productId_idx" ON "MerchantPromotionItem"("productId");
