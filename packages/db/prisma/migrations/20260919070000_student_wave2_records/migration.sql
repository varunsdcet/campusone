CREATE TABLE IF NOT EXISTS "Workshop" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "creditsCeu" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Workshop_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Workshop_institutionId_code_key" ON "Workshop"("institutionId", "code");
CREATE INDEX IF NOT EXISTS "Workshop_institutionId_status_startsAt_idx" ON "Workshop"("institutionId", "status", "startsAt");

CREATE TABLE IF NOT EXISTS "WorkshopRegistration" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "WorkshopRegistration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkshopRegistration_workshopId_studentId_key" ON "WorkshopRegistration"("workshopId", "studentId");
CREATE INDEX IF NOT EXISTS "WorkshopRegistration_institutionId_studentId_status_idx" ON "WorkshopRegistration"("institutionId", "studentId", "status");
DO $$ BEGIN ALTER TABLE "WorkshopRegistration" ADD CONSTRAINT "WorkshopRegistration_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "WorkshopRegistration" ADD CONSTRAINT "WorkshopRegistration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "LeaveOfAbsenceRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startsOn" TEXT NOT NULL,
    "endsOn" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvalRequestId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "LeaveOfAbsenceRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeaveOfAbsenceRequest_institutionId_studentId_status_idx" ON "LeaveOfAbsenceRequest"("institutionId", "studentId", "status");
DO $$ BEGIN ALTER TABLE "LeaveOfAbsenceRequest" ADD CONSTRAINT "LeaveOfAbsenceRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "RequiredTask" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "href" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "RequiredTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RequiredTask_institutionId_studentId_status_idx" ON "RequiredTask"("institutionId", "studentId", "status");
DO $$ BEGIN ALTER TABLE "RequiredTask" ADD CONSTRAINT "RequiredTask_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TaxDocument" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'T2202',
    "taxYear" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "issuedAt" TIMESTAMP(3),
    "downloadUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "TaxDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TaxDocument_institutionId_studentId_taxYear_idx" ON "TaxDocument"("institutionId", "studentId", "taxYear");
DO $$ BEGIN ALTER TABLE "TaxDocument" ADD CONSTRAINT "TaxDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ExtracurricularRecord" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termCode" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'recorded',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ExtracurricularRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ExtracurricularRecord_institutionId_studentId_category_idx" ON "ExtracurricularRecord"("institutionId", "studentId", "category");
DO $$ BEGIN ALTER TABLE "ExtracurricularRecord" ADD CONSTRAINT "ExtracurricularRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "StudentBadge" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "earnedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "StudentBadge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentBadge_studentId_code_key" ON "StudentBadge"("studentId", "code");
CREATE INDEX IF NOT EXISTS "StudentBadge_institutionId_studentId_status_idx" ON "StudentBadge"("institutionId", "studentId", "status");
DO $$ BEGIN ALTER TABLE "StudentBadge" ADD CONSTRAINT "StudentBadge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
