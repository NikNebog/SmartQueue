-- CreateEnum
CREATE TYPE "PlaceType" AS ENUM ('CABINET', 'WINDOW', 'TABLE');

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "placeType" "PlaceType" NOT NULL DEFAULT 'CABINET',
ADD COLUMN     "workingEndTime" TEXT,
ADD COLUMN     "workingStartTime" TEXT;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "isCritical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "language" TEXT;

-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "appName" TEXT NOT NULL DEFAULT 'SmartQ',
    "appIcon" TEXT NOT NULL DEFAULT 'default_icon.png',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
