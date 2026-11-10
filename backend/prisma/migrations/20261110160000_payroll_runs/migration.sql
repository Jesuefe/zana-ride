CREATE TABLE "PayrollRun" (
  "id" TEXT NOT NULL, "month" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'RWF', "totalGross" INTEGER NOT NULL DEFAULT 0,
  "totalNetPay" INTEGER NOT NULL DEFAULT 0, "totalEmployeeDeductions" INTEGER NOT NULL DEFAULT 0,
  "totalEmployerStatutory" INTEGER NOT NULL DEFAULT 0, "totalEmployerCost" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT, "approvedBy" TEXT, "approvedAt" TIMESTAMP(3), "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PayrollLine" (
  "id" TEXT NOT NULL, "payrollRunId" TEXT NOT NULL, "staffMemberId" TEXT NOT NULL,
  "baseSalary" INTEGER NOT NULL, "taxableAllowances" INTEGER NOT NULL DEFAULT 0,
  "nonTaxableAllowances" INTEGER NOT NULL DEFAULT 0, "pensionableAllowances" INTEGER NOT NULL DEFAULT 0,
  "bonus" INTEGER NOT NULL DEFAULT 0, "otherDeductions" INTEGER NOT NULL DEFAULT 0,
  "advanceDeduction" INTEGER NOT NULL DEFAULT 0, "taxableGross" INTEGER NOT NULL,
  "pensionableGross" INTEGER NOT NULL, "paye" INTEGER NOT NULL, "employeePension" INTEGER NOT NULL,
  "employerPension" INTEGER NOT NULL, "employerOccupational" INTEGER NOT NULL,
  "employeeMaternity" INTEGER NOT NULL, "employerMaternity" INTEGER NOT NULL, "cbhi" INTEGER NOT NULL,
  "employeeDeductions" INTEGER NOT NULL, "netPay" INTEGER NOT NULL, "employerStatutoryCost" INTEGER NOT NULL,
  "totalEmployerCost" INTEGER NOT NULL, "paidAmount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'AWAITING_APPROVAL', "payslipSnapshot" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollRun_month_key" ON "PayrollRun"("month");
CREATE INDEX "PayrollRun_status_month_idx" ON "PayrollRun"("status", "month");
CREATE UNIQUE INDEX "PayrollLine_payrollRunId_staffMemberId_key" ON "PayrollLine"("payrollRunId", "staffMemberId");
CREATE INDEX "PayrollLine_staffMemberId_payrollRunId_idx" ON "PayrollLine"("staffMemberId", "payrollRunId");
CREATE INDEX "PayrollLine_status_idx" ON "PayrollLine"("status");
ALTER TABLE "SalaryPayment" ADD COLUMN "payrollLineId" TEXT;
CREATE INDEX "SalaryPayment_payrollLineId_idx" ON "SalaryPayment"("payrollLineId");
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalaryPayment" ADD CONSTRAINT "SalaryPayment_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;