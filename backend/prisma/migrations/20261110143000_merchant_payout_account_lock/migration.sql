ALTER TABLE "Merchant"
  ADD COLUMN "payoutPhone" TEXT,
  ADD COLUMN "payoutProvider" TEXT,
  ADD COLUMN "payoutVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "payoutLockedAt" TIMESTAMP(3);

-- Existing merchants intentionally remain unset and must verify a payout destination
-- before their next merchant withdrawal. Existing driver/agent payout behavior is unchanged.
