-- Existing vehicle registration and insurance uploads were stored at driver level.
-- Attach each to the driver's first registered vehicle so the new per-vehicle
-- review requirement does not discard previously submitted evidence.
WITH ranked_vehicles AS (
  SELECT "id", "driverId", ROW_NUMBER() OVER (PARTITION BY "driverId" ORDER BY "createdAt", "id") AS position
  FROM "DriverVehicle"
)
UPDATE "DriverDocument" AS document
SET "vehicleId" = ranked_vehicles."id"
FROM ranked_vehicles
WHERE ranked_vehicles.position = 1
  AND ranked_vehicles."driverId" = document."driverId"
  AND document."vehicleId" IS NULL
  AND document."label" IN ('Vehicle registration', 'Insurance certificate');
