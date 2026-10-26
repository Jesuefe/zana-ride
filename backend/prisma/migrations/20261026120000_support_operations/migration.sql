ALTER TABLE "SupportChat"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "lastCustomerMessageAt" TIMESTAMP(3),
  ADD COLUMN "lastStaffMessageAt" TIMESTAMP(3),
  ADD COLUMN "lastStaffReadAt" TIMESTAMP(3),
  ADD COLUMN "firstResponseAt" TIMESTAMP(3),
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE INDEX "SupportChat_status_priority_createdAt_idx" ON "SupportChat"("status", "priority", "createdAt");
CREATE INDEX "SupportChat_lastCustomerMessageAt_lastStaffReadAt_idx" ON "SupportChat"("lastCustomerMessageAt", "lastStaffReadAt");
