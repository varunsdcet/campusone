ALTER TABLE "Placement"
  ADD COLUMN "siteId" TEXT,
  ADD COLUMN "supervisorPersonId" TEXT,
  ADD COLUMN "opportunityId" TEXT;

CREATE INDEX "Placement_institutionId_supervisorPersonId_idx"
  ON "Placement"("institutionId", "supervisorPersonId");

CREATE INDEX "Placement_institutionId_siteId_idx"
  ON "Placement"("institutionId", "siteId");
