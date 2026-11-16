CREATE TABLE "ApiPartner" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiPartner_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ApiCredential" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'LIVE',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiCredential_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ApiPartnerWallet" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RWF',
  "available" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "creditLimit" INTEGER NOT NULL DEFAULT 0,
  "suspendedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiPartnerWallet_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ApiPartnerWalletTransaction" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "availableBefore" INTEGER NOT NULL,
  "availableAfter" INTEGER NOT NULL,
  "reservedBefore" INTEGER NOT NULL,
  "reservedAfter" INTEGER NOT NULL,
  "reference" TEXT NOT NULL,
  "description" TEXT,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiPartnerWalletTransaction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ApiIdempotencyKey" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "responseJson" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiIdempotencyKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiCredential_secretHash_key" ON "ApiCredential"("secretHash");
CREATE INDEX "ApiCredential_partnerId_active_idx" ON "ApiCredential"("partnerId", "active");
CREATE INDEX "ApiCredential_keyPrefix_idx" ON "ApiCredential"("keyPrefix");
CREATE UNIQUE INDEX "ApiPartnerWallet_partnerId_key" ON "ApiPartnerWallet"("partnerId");
CREATE UNIQUE INDEX "ApiPartnerWalletTransaction_reference_key" ON "ApiPartnerWalletTransaction"("reference");
CREATE INDEX "ApiPartnerWalletTransaction_walletId_createdAt_idx" ON "ApiPartnerWalletTransaction"("walletId", "createdAt");
CREATE INDEX "ApiPartnerWalletTransaction_type_createdAt_idx" ON "ApiPartnerWalletTransaction"("type", "createdAt");
CREATE UNIQUE INDEX "ApiIdempotencyKey_partnerId_key_key" ON "ApiIdempotencyKey"("partnerId", "key");
CREATE INDEX "ApiIdempotencyKey_expiresAt_idx" ON "ApiIdempotencyKey"("expiresAt");
CREATE INDEX "ApiPartner_status_createdAt_idx" ON "ApiPartner"("status", "createdAt");
ALTER TABLE "ApiCredential" ADD CONSTRAINT "ApiCredential_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ApiPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiPartnerWallet" ADD CONSTRAINT "ApiPartnerWallet_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ApiPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiPartnerWalletTransaction" ADD CONSTRAINT "ApiPartnerWalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ApiPartnerWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApiIdempotencyKey" ADD CONSTRAINT "ApiIdempotencyKey_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ApiPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
