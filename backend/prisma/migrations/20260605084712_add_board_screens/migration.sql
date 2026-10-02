-- CreateTable
CREATE TABLE "board_screens" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "roomNames" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_screens_pkey" PRIMARY KEY ("id")
);
