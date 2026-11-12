ALTER TABLE "Delivery"
ADD COLUMN "promoDiscount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PromoCodeRedemption"
ADD COLUMN "deliveryId" TEXT;

CREATE UNIQUE INDEX "PromoCodeRedemption_deliveryId_key"
ON "PromoCodeRedemption"("deliveryId");

ALTER TABLE "PromoCodeRedemption"
ADD CONSTRAINT "PromoCodeRedemption_deliveryId_fkey"
FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
