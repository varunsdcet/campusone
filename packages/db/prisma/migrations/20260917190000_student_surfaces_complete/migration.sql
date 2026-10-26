-- Student surfaces domain: assessments, attendance, labs, services, finance, credentials, practicum link

ALTER TABLE "ClassSession" ADD COLUMN IF NOT EXISTS "sessionKind" TEXT NOT NULL DEFAULT 'lecture';
CREATE INDEX IF NOT EXISTS "ClassSession_institutionId_sessionKind_idx" ON "ClassSession"("institutionId", "sessionKind");

ALTER TABLE "Placement" ADD COLUMN IF NOT EXISTS "studentId" TEXT;
CREATE INDEX IF NOT EXISTS "Placement_institutionId_studentId_idx" ON "Placement"("institutionId", "studentId");
ALTER TABLE "Placement" DROP CONSTRAINT IF EXISTS "Placement_studentId_fkey";
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Assessment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssessmentAttempt" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "classSessionId" TEXT,
    "meetingLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LabNotebookEntry" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classSessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "LabNotebookEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "approvalRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinanceLedgerEntry" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountCad" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "FinanceLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CredentialRecord" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "detail" TEXT,
    "earnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CredentialRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Assessment_institutionId_sectionId_idx" ON "Assessment"("institutionId", "sectionId");
CREATE INDEX IF NOT EXISTS "Assessment_institutionId_status_opensAt_idx" ON "Assessment"("institutionId", "status", "opensAt");
CREATE INDEX IF NOT EXISTS "AssessmentAttempt_institutionId_studentId_status_idx" ON "AssessmentAttempt"("institutionId", "studentId", "status");
CREATE INDEX IF NOT EXISTS "AssessmentAttempt_assessmentId_studentId_idx" ON "AssessmentAttempt"("assessmentId", "studentId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_institutionId_studentId_idx" ON "AttendanceRecord"("institutionId", "studentId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_sectionId_recordedAt_idx" ON "AttendanceRecord"("sectionId", "recordedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "LabNotebookEntry_studentId_classSessionId_key" ON "LabNotebookEntry"("studentId", "classSessionId");
CREATE INDEX IF NOT EXISTS "LabNotebookEntry_institutionId_studentId_idx" ON "LabNotebookEntry"("institutionId", "studentId");
CREATE INDEX IF NOT EXISTS "ServiceRequest_institutionId_studentId_status_idx" ON "ServiceRequest"("institutionId", "studentId", "status");
CREATE INDEX IF NOT EXISTS "FinanceLedgerEntry_institutionId_studentId_postedAt_idx" ON "FinanceLedgerEntry"("institutionId", "studentId", "postedAt");
CREATE INDEX IF NOT EXISTS "CredentialRecord_institutionId_studentId_status_idx" ON "CredentialRecord"("institutionId", "studentId", "status");

ALTER TABLE "Assessment" DROP CONSTRAINT IF EXISTS "Assessment_sectionId_fkey";
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttempt" DROP CONSTRAINT IF EXISTS "AssessmentAttempt_assessmentId_fkey";
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentAttempt" DROP CONSTRAINT IF EXISTS "AssessmentAttempt_studentId_fkey";
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_studentId_fkey";
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_sectionId_fkey";
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT IF EXISTS "AttendanceRecord_classSessionId_fkey";
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabNotebookEntry" DROP CONSTRAINT IF EXISTS "LabNotebookEntry_studentId_fkey";
ALTER TABLE "LabNotebookEntry" ADD CONSTRAINT "LabNotebookEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabNotebookEntry" DROP CONSTRAINT IF EXISTS "LabNotebookEntry_classSessionId_fkey";
ALTER TABLE "LabNotebookEntry" ADD CONSTRAINT "LabNotebookEntry_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" DROP CONSTRAINT IF EXISTS "ServiceRequest_studentId_fkey";
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceLedgerEntry" DROP CONSTRAINT IF EXISTS "FinanceLedgerEntry_studentId_fkey";
ALTER TABLE "FinanceLedgerEntry" ADD CONSTRAINT "FinanceLedgerEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CredentialRecord" DROP CONSTRAINT IF EXISTS "CredentialRecord_studentId_fkey";
ALTER TABLE "CredentialRecord" ADD CONSTRAINT "CredentialRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
