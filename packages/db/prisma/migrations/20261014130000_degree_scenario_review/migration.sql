ALTER TABLE "DegreePlanScenario"
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT;

CREATE INDEX "DegreePlanScenario_institutionId_status_createdAt_idx"
  ON "DegreePlanScenario"("institutionId", "status", "createdAt");
