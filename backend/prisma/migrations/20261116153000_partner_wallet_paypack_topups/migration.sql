ALTER TABLE "ApiPartnerWalletTransaction"
  ADD COLUMN "providerRef" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'COMPLETED';
CREATE UNIQUE INDEX "ApiPartnerWalletTransaction_providerRef_key"
  ON "ApiPartnerWalletTransaction"("providerRef");
