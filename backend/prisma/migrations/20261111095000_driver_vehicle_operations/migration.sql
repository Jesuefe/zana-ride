CREATE TABLE "DriverVehicle" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "vehicleType" TEXT NOT NULL,
  "make" TEXT,
  "model" TEXT,
  "year" INTEGER,
  "color" TEXT,
  "plate" TEXT NOT NULL,
  "registrationNumber" TEXT,
  "chassisNumber" TEXT,
  "ownershipType" TEXT NOT NULL DEFAULT 'SELF',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DriverVehicle_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "DriverDocument"
  ADD COLUMN "vehicleId" TEXT,
  ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "supersededAt" TIMESTAMP(3);
CREATE INDEX "DriverVehicle_driverId_status_createdAt_idx" ON "DriverVehicle"("driverId","status","createdAt");
CREATE INDEX "DriverVehicle_plate_idx" ON "DriverVehicle"("plate");
CREATE INDEX "DriverDocument_driverId_label_createdAt_idx" ON "DriverDocument"("driverId","label","createdAt");
CREATE INDEX "DriverDocument_vehicleId_createdAt_idx" ON "DriverDocument"("vehicleId","createdAt");
CREATE INDEX "DriverDocument_reviewStatus_expiresAt_idx" ON "DriverDocument"("reviewStatus","expiresAt");
ALTER TABLE "DriverVehicle" ADD CONSTRAINT "DriverVehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverDocument" ADD CONSTRAINT "DriverDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "DriverVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve the existing driver's vehicle and approval state in the new registry.
INSERT INTO "DriverVehicle" (
  "id", "driverId", "vehicleType", "make", "plate", "status", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  d."id",
  CASE WHEN d."serviceType" = 'BIKE' THEN 'MOTORCYCLE' ELSE 'CAR' END,
  d."vehicle",
  d."plate",
  d."approvalStatus"::text,
  d."createdAt",
  CURRENT_TIMESTAMP
FROM "Driver" d
WHERE COALESCE(BTRIM(d."plate"), '') <> '';

UPDATE "DriverDocument"
SET "reviewStatus" = CASE WHEN "verified" THEN 'VERIFIED' ELSE 'PENDING' END;
