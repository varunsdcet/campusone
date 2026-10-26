-- AlterTable
CREATE TABLE "PortalRecord" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "screenPath" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "primaryText" TEXT NOT NULL,
    "secondaryText" TEXT,
    "metaText" TEXT,
    "href" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "audienceAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PortalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalRecord_institutionId_screenPath_idx" ON "PortalRecord"("institutionId", "screenPath");

-- CreateIndex
CREATE INDEX "PortalRecord_institutionId_role_idx" ON "PortalRecord"("institutionId", "role");
