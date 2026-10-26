-- Wave 1: Cohort, ProgramPlan, retake attempts, course evaluations

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "cohortId" TEXT;
CREATE INDEX IF NOT EXISTS "Student_cohortId_idx" ON "Student"("cohortId");

CREATE TABLE IF NOT EXISTS "Cohort" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "intakeYear" INTEGER NOT NULL,
    "intakeMonth" INTEGER NOT NULL,
    "sectionLabel" TEXT NOT NULL DEFAULT 'A',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Cohort_institutionId_code_key" ON "Cohort"("institutionId", "code");
CREATE INDEX IF NOT EXISTS "Cohort_institutionId_programId_idx" ON "Cohort"("institutionId", "programId");

DO $$ BEGIN
  ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Student" ADD CONSTRAINT "Student_cohortId_fkey"
    FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ProgramPlan" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "cohortId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ProgramPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProgramPlan_institutionId_studentId_idx" ON "ProgramPlan"("institutionId", "studentId");
CREATE INDEX IF NOT EXISTS "ProgramPlan_cohortId_idx" ON "ProgramPlan"("cohortId");

DO $$ BEGIN
  ALTER TABLE "ProgramPlan" ADD CONSTRAINT "ProgramPlan_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProgramPlan" ADD CONSTRAINT "ProgramPlan_cohortId_fkey"
    FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ProgramPlanItem" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "courseId" TEXT,
    "courseCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL DEFAULT 'main',
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "startsOn" TEXT,
    "endsOn" TEXT,
    "scheduleText" TEXT,
    "sectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ProgramPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProgramPlanItem_institutionId_planId_sortOrder_idx" ON "ProgramPlanItem"("institutionId", "planId", "sortOrder");
CREATE INDEX IF NOT EXISTS "ProgramPlanItem_courseId_idx" ON "ProgramPlanItem"("courseId");

DO $$ BEGIN
  ALTER TABLE "ProgramPlanItem" ADD CONSTRAINT "ProgramPlanItem_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "ProgramPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProgramPlanItem" ADD CONSTRAINT "ProgramPlanItem_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CourseEvaluation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT,
    "courseCode" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CourseEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CourseEvaluation_institutionId_studentId_status_idx" ON "CourseEvaluation"("institutionId", "studentId", "status");

DO $$ BEGIN
  ALTER TABLE "CourseEvaluation" ADD CONSTRAINT "CourseEvaluation_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Enrolment" ADD COLUMN IF NOT EXISTS "attemptNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Enrolment" ADD COLUMN IF NOT EXISTS "countsTowardCgpa" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "Enrolment_studentId_status_idx" ON "Enrolment"("studentId", "status");

ALTER TABLE "Enrolment" DROP CONSTRAINT IF EXISTS "Enrolment_sectionId_studentId_key";
DROP INDEX IF EXISTS "Enrolment_sectionId_studentId_key";

DO $$ BEGIN
  CREATE UNIQUE INDEX "Enrolment_sectionId_studentId_attemptNumber_key"
    ON "Enrolment"("sectionId", "studentId", "attemptNumber");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
