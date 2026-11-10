CREATE TABLE "ImpactFundDisbursement" (
  "id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RWF',
  "recipientName" TEXT NOT NULL,
  "recipientType" TEXT NOT NULL DEFAULT 'PROGRAM',
  "purpose" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "requestedBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "paidBy" TEXT,
  "paymentMethod" TEXT,
  "paymentReference" TEXT,
  "evidenceUrl" TEXT,
  "rejectionReason" TEXT,
  "rejectedBy" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImpactFundDisbursement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImpactFundDisbursement_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "ImpactFundDisbursement_status_check" CHECK ("status" IN ('REQUESTED','APPROVED','PAID','REJECTED'))
);
CREATE INDEX "ImpactFundDisbursement_status_requestedAt_idx" ON "ImpactFundDisbursement"("status","requestedAt");
CREATE INDEX "ImpactFundDisbursement_requestedBy_requestedAt_idx" ON "ImpactFundDisbursement"("requestedBy","requestedAt");
CREATE INDEX "ImpactFundDisbursement_paymentReference_idx" ON "ImpactFundDisbursement"("paymentReference");