ALTER TABLE "User"
  ADD COLUMN "adminTotpSecretEnc" TEXT,
  ADD COLUMN "adminTotpPendingSecretEnc" TEXT,
  ADD COLUMN "adminTotpEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "adminTotpEnabledAt" TIMESTAMP(3),
  ADD COLUMN "adminTotpRecoveryCodes" TEXT;
