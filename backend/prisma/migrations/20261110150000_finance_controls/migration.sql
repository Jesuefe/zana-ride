ALTER TABLE "Expense" ADD COLUMN "vendor" TEXT, ADD COLUMN "invoiceNumber" TEXT, ADD COLUMN "paymentReference" TEXT, ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID', ADD COLUMN "amountPaid" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APPROVED', ADD COLUMN "dueDate" TIMESTAMP(3), ADD COLUMN "paidAt" TIMESTAMP(3), ADD COLUMN "voidedAt" TIMESTAMP(3), ADD COLUMN "voidReason" TEXT;
ALTER TABLE "StaffMember" ADD COLUMN "department" TEXT, ADD COLUMN "employmentType" TEXT NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE "StaffMember" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "SalaryPayment" ADD COLUMN "paymentReference" TEXT, ADD COLUMN "paymentMethod" TEXT;
CREATE INDEX "Expense_date_status_idx" ON "Expense"("date", "status");
CREATE INDEX "Expense_category_date_idx" ON "Expense"("category", "date");
CREATE INDEX "SalaryPayment_month_paid_idx" ON "SalaryPayment"("month", "paid");
CREATE INDEX "SalaryPayment_staffMemberId_month_idx" ON "SalaryPayment"("staffMemberId", "month");

ALTER TABLE "ImpactFundConfig" ADD COLUMN "profitBasedFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "StaffSalaryHistory" (
    "id" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "baseSalary" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffSalaryHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StaffSalaryHistory_staffMemberId_effectiveFrom_idx" ON "StaffSalaryHistory"("staffMemberId", "effectiveFrom");
ALTER TABLE "StaffSalaryHistory" ADD CONSTRAINT "StaffSalaryHistory_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "StaffSalaryHistory" ("id", "staffMemberId", "baseSalary", "effectiveFrom", "createdAt")
SELECT gen_random_uuid()::text, "id", "salary", "startDate", CURRENT_TIMESTAMP FROM "StaffMember";

ALTER TABLE "Expense" ALTER COLUMN "status" SET DEFAULT 'PENDING';