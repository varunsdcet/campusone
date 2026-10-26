-- PART D registrar gaps: profile fields, docs, mail policy, finance/tax/enrolment extras

ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "middleName" TEXT;
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "preferredName" TEXT;
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "personalEmail" TEXT;
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "sinMasked" TEXT;
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT;
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT;

ALTER TABLE "Cohort" ADD COLUMN IF NOT EXISTS "campus" TEXT;
ALTER TABLE "Cohort" ADD COLUMN IF NOT EXISTS "startDate" TEXT;
ALTER TABLE "Cohort" ADD COLUMN IF NOT EXISTS "endDate" TEXT;

ALTER TABLE "Enrolment" ADD COLUMN IF NOT EXISTS "creditAwarded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Enrolment" ADD COLUMN IF NOT EXISTS "continuous" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Enrolment" ADD COLUMN IF NOT EXISTS "originalEnrolmentId" TEXT;
CREATE INDEX IF NOT EXISTS "Enrolment_originalEnrolmentId_idx" ON "Enrolment"("originalEnrolmentId");

ALTER TABLE "FinanceLedgerEntry" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "FinanceLedgerEntry" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "FinanceLedgerEntry" ADD COLUMN IF NOT EXISTS "reversedFromId" TEXT;
CREATE INDEX IF NOT EXISTS "FinanceLedgerEntry_reversedFromId_idx" ON "FinanceLedgerEntry"("reversedFromId");

ALTER TABLE "TaxDocument" ADD COLUMN IF NOT EXISTS "eligibleTuitionCad" DOUBLE PRECISION;
ALTER TABLE "TaxDocument" ADD COLUMN IF NOT EXISTS "enrolmentMonths" INTEGER;
ALTER TABLE "TaxDocument" ADD COLUMN IF NOT EXISTS "sinLast4" TEXT;
ALTER TABLE "TaxDocument" ADD COLUMN IF NOT EXISTS "craStatus" TEXT NOT NULL DEFAULT 'pending';

DROP INDEX IF EXISTS "TaxDocument_institutionId_studentId_taxYear_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "TaxDocument_institutionId_studentId_docType_taxYear_key"
  ON "TaxDocument"("institutionId", "studentId", "docType", "taxYear");
CREATE INDEX IF NOT EXISTS "TaxDocument_institutionId_studentId_taxYear_idx"
  ON "TaxDocument"("institutionId", "studentId", "taxYear");

CREATE TABLE IF NOT EXISTS "StudentDocument" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "recordName" TEXT NOT NULL,
  "recordDate" TEXT,
  "docLabel" TEXT,
  "downloadUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'available',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudentDocument_institutionId_studentId_recordDate_idx"
  ON "StudentDocument"("institutionId", "studentId", "recordDate");

DO $$ BEGIN
  ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "InstitutionMailPolicy" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "allowStudentForwarding" BOOLEAN NOT NULL DEFAULT true,
  "allowSmsForwarding" BOOLEAN NOT NULL DEFAULT false,
  "requireRegistrarAudit" BOOLEAN NOT NULL DEFAULT true,
  "maxForwardAddressLength" INTEGER NOT NULL DEFAULT 200,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "InstitutionMailPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InstitutionMailPolicy_institutionId_key"
  ON "InstitutionMailPolicy"("institutionId");
