ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "businessDate" DATE;

UPDATE "tickets"
SET "businessDate" = "createdAt"::date
WHERE "businessDate" IS NULL;

ALTER TABLE "tickets" ALTER COLUMN "businessDate" SET DEFAULT CURRENT_DATE;
ALTER TABLE "tickets" ALTER COLUMN "businessDate" SET NOT NULL;

DROP INDEX IF EXISTS "tickets_number_key";

CREATE UNIQUE INDEX IF NOT EXISTS "tickets_number_businessDate_key"
ON "tickets"("number", "businessDate");
