CREATE TABLE "MerchantLead" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsappPhone" TEXT,
    "businessAddress" TEXT NOT NULL,
    "locationsCount" TEXT NOT NULL DEFAULT '1',
    "deliveryPreference" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "internalNotes" TEXT,
    "contactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantLead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MerchantLead_status_createdAt_idx" ON "MerchantLead"("status", "createdAt");
CREATE INDEX "MerchantLead_phone_idx" ON "MerchantLead"("phone");
CREATE INDEX "MerchantLead_businessName_idx" ON "MerchantLead"("businessName");
