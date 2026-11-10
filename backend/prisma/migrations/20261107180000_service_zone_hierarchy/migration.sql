ALTER TABLE "ServiceZone" ADD COLUMN IF NOT EXISTS "zoneLevel" TEXT NOT NULL DEFAULT 'MINI';
ALTER TABLE "ServiceZone" ADD COLUMN IF NOT EXISTS "parentZoneId" TEXT;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ServiceZone_parentZoneId_fkey') THEN ALTER TABLE "ServiceZone" ADD CONSTRAINT "ServiceZone_parentZoneId_fkey" FOREIGN KEY ("parentZoneId") REFERENCES "ServiceZone"("id") ON DELETE SET NULL; END IF; END $$;
CREATE INDEX IF NOT EXISTS "ServiceZone_parentZoneId_idx" ON "ServiceZone"("parentZoneId");
CREATE INDEX IF NOT EXISTS "ServiceZone_city_zoneLevel_idx" ON "ServiceZone"(city,"zoneLevel");