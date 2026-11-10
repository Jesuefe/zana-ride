CREATE TABLE "SalaryAdvance" (
  "id" TEXT NOT NULL, "staffMemberId" TEXT NOT NULL, "principalAmount" INTEGER NOT NULL,
  "outstandingAmount" INTEGER NOT NULL, "monthlyDeduction" INTEGER NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "dueDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'REQUESTED', "approvedBy" TEXT, "approvedAt" TIMESTAMP(3), "paymentReference" TEXT, "paymentMethod" TEXT, "paidAt" TIMESTAMP(3), "note" TEXT, "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalaryAdvance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalaryAdvance_amounts_check" CHECK ("principalAmount" > 0 AND "outstandingAmount" >= 0 AND "monthlyDeduction" > 0),
  CONSTRAINT "SalaryAdvance_status_check" CHECK ("status" IN ('REQUESTED','APPROVED','ACTIVE','SETTLED','CANCELLED'))
);
CREATE INDEX "SalaryAdvance_staffMemberId_status_idx" ON "SalaryAdvance"("staffMemberId","status");
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SalaryAdvanceRecovery" (
  "id" TEXT NOT NULL, "advanceId" TEXT NOT NULL, "payrollLineId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "postedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalaryAdvanceRecovery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalaryAdvanceRecovery_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "SalaryAdvanceRecovery_status_check" CHECK ("status" IN ('RESERVED','POSTED','RELEASED'))
);
CREATE UNIQUE INDEX "SalaryAdvanceRecovery_advanceId_payrollLineId_key" ON "SalaryAdvanceRecovery"("advanceId","payrollLineId");
CREATE INDEX "SalaryAdvanceRecovery_payrollLineId_status_idx" ON "SalaryAdvanceRecovery"("payrollLineId","status");
ALTER TABLE "SalaryAdvanceRecovery" ADD CONSTRAINT "SalaryAdvanceRecovery_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "SalaryAdvance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalaryAdvanceRecovery" ADD CONSTRAINT "SalaryAdvanceRecovery_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ContractorInvoice" (
  "id" TEXT NOT NULL, "staffMemberId" TEXT, "contractorName" TEXT NOT NULL, "invoiceNumber" TEXT NOT NULL,
  "invoiceDate" TIMESTAMP(3) NOT NULL, "dueDate" TIMESTAMP(3), "description" TEXT NOT NULL,
  "grossAmount" INTEGER NOT NULL, "withholdingRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "withholdingAmount" INTEGER NOT NULL DEFAULT 0, "netPayable" INTEGER NOT NULL, "amountPaid" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'RWF', "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "paymentReference" TEXT, "paymentMethod" TEXT, "paidAt" TIMESTAMP(3), "evidenceUrl" TEXT,
  "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3), "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractorInvoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContractorInvoice_amounts_check" CHECK ("grossAmount" > 0 AND "withholdingAmount" >= 0 AND "netPayable" >= 0 AND "amountPaid" >= 0 AND "amountPaid" <= "netPayable" AND "netPayable" + "withholdingAmount" = "grossAmount"),
  CONSTRAINT "ContractorInvoice_rate_check" CHECK ("withholdingRate" >= 0 AND "withholdingRate" <= 100),
  CONSTRAINT "ContractorInvoice_status_check" CHECK ("status" IN ('SUBMITTED','APPROVED','REJECTED','PARTIALLY_PAID','PAID'))
);
CREATE UNIQUE INDEX "ContractorInvoice_contractorName_invoiceNumber_key" ON "ContractorInvoice"("contractorName","invoiceNumber");
CREATE INDEX "ContractorInvoice_status_invoiceDate_idx" ON "ContractorInvoice"("status","invoiceDate");
ALTER TABLE "ContractorInvoice" ADD CONSTRAINT "ContractorInvoice_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StatutoryRemittance" (
  "id" TEXT NOT NULL, "period" TEXT NOT NULL, "obligationType" TEXT NOT NULL, "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RWF', "dueDate" TIMESTAMP(3), "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "sourcePayrollRunId" TEXT, "paymentReference" TEXT, "paymentMethod" TEXT, "paidAt" TIMESTAMP(3),
  "evidenceUrl" TEXT, "notes" TEXT, "createdBy" TEXT, "approvedBy" TEXT, "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StatutoryRemittance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StatutoryRemittance_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "StatutoryRemittance_status_check" CHECK ("status" IN ('DRAFT','APPROVED','PAID','CANCELLED'))
);
CREATE UNIQUE INDEX "StatutoryRemittance_period_obligationType_key" ON "StatutoryRemittance"("period","obligationType");
CREATE INDEX "StatutoryRemittance_status_dueDate_idx" ON "StatutoryRemittance"("status","dueDate");

ALTER TABLE "StatutoryRemittance" ADD COLUMN "accountantVerifiedBy" TEXT, ADD COLUMN "accountantVerifiedAt" TIMESTAMP(3), ADD COLUMN "accountantVerificationNote" TEXT;