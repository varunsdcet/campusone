-- Course fees posted on enrolment (or linked from Add Fee) record the course / section they are for
ALTER TABLE "FinanceLedgerEntry" ADD COLUMN IF NOT EXISTS "courseId" TEXT;
ALTER TABLE "FinanceLedgerEntry" ADD COLUMN IF NOT EXISTS "sectionId" TEXT;
CREATE INDEX IF NOT EXISTS "FinanceLedgerEntry_sectionId_idx" ON "FinanceLedgerEntry"("sectionId");
