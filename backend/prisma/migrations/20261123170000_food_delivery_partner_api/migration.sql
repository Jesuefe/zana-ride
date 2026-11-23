-- Prepaid partner accounts for external food-ordering platforms.
CREATE TABLE "FoodDeliveryPartner" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactEmail" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "balance" INTEGER NOT NULL DEFAULT 0,
  "apiKeyHash" TEXT NOT NULL,
  "apiKeyPrefix" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FoodDeliveryPartner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FoodDeliveryPartner_apiKeyHash_key" ON "FoodDeliveryPartner"("apiKeyHash");
CREATE INDEX "FoodDeliveryPartner_status_createdAt_idx" ON "FoodDeliveryPartner"("status", "createdAt");

CREATE TABLE "PartnerWalletTransaction" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "deliveryId" TEXT,
  "amount" INTEGER NOT NULL,
  "balanceBefore" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "reference" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerWalletTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartnerWalletTransaction_deliveryId_key" ON "PartnerWalletTransaction"("deliveryId");
CREATE INDEX "PartnerWalletTransaction_partnerId_createdAt_idx" ON "PartnerWalletTransaction"("partnerId", "createdAt");
ALTER TABLE "PartnerWalletTransaction" ADD CONSTRAINT "PartnerWalletTransaction_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "FoodDeliveryPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartnerWalletTransaction" ADD CONSTRAINT "PartnerWalletTransaction_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Delivery" ADD COLUMN "partnerId" TEXT;
ALTER TABLE "Delivery" ADD COLUMN "partnerOrderRef" TEXT;
CREATE UNIQUE INDEX "Delivery_partnerId_partnerOrderRef_key" ON "Delivery"("partnerId", "partnerOrderRef");
CREATE INDEX "Delivery_partnerId_createdAt_idx" ON "Delivery"("partnerId", "createdAt");
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "FoodDeliveryPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
