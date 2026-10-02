CREATE TYPE "PrintJobStatus" AS ENUM ('pending', 'claimed', 'printing', 'printed', 'failed');
CREATE TYPE "PrintJobFormat" AS ENUM ('escpos_raw');

CREATE TABLE "print_jobs" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER,
    "format" "PrintJobFormat" NOT NULL DEFAULT 'escpos_raw',
    "status" "PrintJobStatus" NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "rawContentBase64" TEXT NOT NULL,
    "printerName" TEXT,
    "claimedBy" TEXT,
    "claimedAt" TIMESTAMP(3),
    "printedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "print_jobs_ticketId_key" ON "print_jobs"("ticketId");
CREATE INDEX "print_jobs_status_createdAt_idx" ON "print_jobs"("status", "createdAt");

ALTER TABLE "print_jobs"
ADD CONSTRAINT "print_jobs_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
