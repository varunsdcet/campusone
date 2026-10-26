-- Workshops module: categories, roles, admin settings
CREATE TABLE IF NOT EXISTS "WorkshopCategory" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "abbreviation" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "WorkshopCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkshopCategory_institutionId_name_key" ON "WorkshopCategory"("institutionId", "name");

CREATE TABLE IF NOT EXISTS "WorkshopRole" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "outcomesJson" TEXT NOT NULL DEFAULT '[]',
  "competenciesJson" TEXT NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "WorkshopRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkshopRole_institutionId_name_key" ON "WorkshopRole"("institutionId", "name");

ALTER TABLE "Workshop" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "Workshop" ADD COLUMN IF NOT EXISTS "settingsJson" TEXT NOT NULL DEFAULT '{}';
DO $$ BEGIN ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "WorkshopCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "WorkshopRegistration" ADD COLUMN IF NOT EXISTS "roleId" TEXT;
