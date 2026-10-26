-- Wave 3: AcademicBlock vs FinancialTerm, day-blocks, folders/syllabus, mail, eval submit

CREATE TABLE IF NOT EXISTS "AcademicBlock" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" TEXT NOT NULL,
    "endsOn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AcademicBlock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AcademicBlock_institutionId_code_key" ON "AcademicBlock"("institutionId", "code");
CREATE INDEX IF NOT EXISTS "AcademicBlock_institutionId_startsOn_idx" ON "AcademicBlock"("institutionId", "startsOn");

CREATE TABLE IF NOT EXISTS "FinancialTerm" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" TEXT NOT NULL,
    "endsOn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "FinancialTerm_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FinancialTerm_institutionId_code_key" ON "FinancialTerm"("institutionId", "code");
CREATE INDEX IF NOT EXISTS "FinancialTerm_institutionId_startsOn_idx" ON "FinancialTerm"("institutionId", "startsOn");

ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "academicBlockId" TEXT;
CREATE INDEX IF NOT EXISTS "Section_academicBlockId_idx" ON "Section"("academicBlockId");
DO $$ BEGIN
  ALTER TABLE "Section" ADD CONSTRAINT "Section_academicBlockId_fkey"
    FOREIGN KEY ("academicBlockId") REFERENCES "AcademicBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "FinanceLedgerEntry" ADD COLUMN IF NOT EXISTS "financialTermId" TEXT;
CREATE INDEX IF NOT EXISTS "FinanceLedgerEntry_financialTermId_idx" ON "FinanceLedgerEntry"("financialTermId");
DO $$ BEGIN
  ALTER TABLE "FinanceLedgerEntry" ADD CONSTRAINT "FinanceLedgerEntry_financialTermId_fkey"
    FOREIGN KEY ("financialTermId") REFERENCES "FinancialTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CourseDayBlock" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CourseDayBlock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CourseDayBlock_institutionId_sectionId_sortOrder_idx" ON "CourseDayBlock"("institutionId", "sectionId", "sortOrder");
DO $$ BEGIN
  ALTER TABLE "CourseDayBlock" ADD CONSTRAINT "CourseDayBlock_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CourseLesson" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "dayBlockId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "resourceHref" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CourseLesson_institutionId_dayBlockId_sortOrder_idx" ON "CourseLesson"("institutionId", "dayBlockId", "sortOrder");
DO $$ BEGIN
  ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_dayBlockId_fkey"
    FOREIGN KEY ("dayBlockId") REFERENCES "CourseDayBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CourseFolder" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CourseFolder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CourseFolder_institutionId_sectionId_sortOrder_idx" ON "CourseFolder"("institutionId", "sectionId", "sortOrder");
DO $$ BEGIN
  ALTER TABLE "CourseFolder" ADD CONSTRAINT "CourseFolder_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CourseFolderItem" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'file',
    "href" TEXT,
    "sizeLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CourseFolderItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CourseFolderItem_institutionId_folderId_sortOrder_idx" ON "CourseFolderItem"("institutionId", "folderId", "sortOrder");
DO $$ BEGIN
  ALTER TABLE "CourseFolderItem" ADD CONSTRAINT "CourseFolderItem_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "CourseFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SyllabusTopic" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "SyllabusTopic_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SyllabusTopic_institutionId_sectionId_sortOrder_idx" ON "SyllabusTopic"("institutionId", "sectionId", "sortOrder");
DO $$ BEGIN
  ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "CourseEvaluation" ADD COLUMN IF NOT EXISTS "overallRating" INTEGER;
ALTER TABLE "CourseEvaluation" ADD COLUMN IF NOT EXISTS "responsesJson" TEXT;

CREATE TABLE IF NOT EXISTS "MailFolder" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "MailFolder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MailFolder_institutionId_accountId_sortOrder_idx" ON "MailFolder"("institutionId", "accountId", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "MailFolder_accountId_kind_name_key" ON "MailFolder"("accountId", "kind", "name");

CREATE TABLE IF NOT EXISTS "MailThreadPlacement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "MailThreadPlacement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MailThreadPlacement_accountId_threadId_key" ON "MailThreadPlacement"("accountId", "threadId");
CREATE INDEX IF NOT EXISTS "MailThreadPlacement_institutionId_folderId_idx" ON "MailThreadPlacement"("institutionId", "folderId");
DO $$ BEGIN
  ALTER TABLE "MailThreadPlacement" ADD CONSTRAINT "MailThreadPlacement_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "MailFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MailThreadPlacement" ADD CONSTRAINT "MailThreadPlacement_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MailboxSettings" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "forwardingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "forwardingAddress" TEXT,
    "smsForwardingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "signature" TEXT,
    "popupNotifications" BOOLEAN NOT NULL DEFAULT true,
    "notificationSound" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "MailboxSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MailboxSettings_accountId_key" ON "MailboxSettings"("accountId");
CREATE INDEX IF NOT EXISTS "MailboxSettings_institutionId_idx" ON "MailboxSettings"("institutionId");
