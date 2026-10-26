-- CreateTable
CREATE TABLE "SisScreenState" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SisScreenState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SisScreenState_institutionId_idx" ON "SisScreenState"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "SisScreenState_institutionId_path_key" ON "SisScreenState"("institutionId", "path");
