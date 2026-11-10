-- CreateTable
CREATE TABLE "ImpactFundConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "ratePercent" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ImpactFundConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactFundEntry" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "platformCommission" INTEGER NOT NULL,
    "contributionAmount" INTEGER NOT NULL,
    "ratePercent" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACCRUED',
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImpactFundEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImpactFundEntry_idempotencyKey_key" ON "ImpactFundEntry"("idempotencyKey");
CREATE INDEX "ImpactFundEntry_sourceType_sourceId_createdAt_idx" ON "ImpactFundEntry"("sourceType", "sourceId", "createdAt");
CREATE INDEX "ImpactFundEntry_eventType_createdAt_idx" ON "ImpactFundEntry"("eventType", "createdAt");
CREATE INDEX "ImpactFundEntry_createdAt_idx" ON "ImpactFundEntry"("createdAt");
