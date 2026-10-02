-- CreateTable
CREATE TABLE "board_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "settings" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_settings_pkey" PRIMARY KEY ("id")
);
