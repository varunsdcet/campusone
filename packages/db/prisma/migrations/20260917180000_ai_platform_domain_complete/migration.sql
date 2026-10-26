-- AI platform domain completion: rubrics, advising, success cases, transfer/coreq, offerings, telemetry

ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "rubricId" TEXT;

ALTER TABLE "AiInteraction" ADD COLUMN IF NOT EXISTS "capability" TEXT NOT NULL DEFAULT 'campus_coach';
ALTER TABLE "AiInteraction" ADD COLUMN IF NOT EXISTS "latencyMs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiInteraction" ADD COLUMN IF NOT EXISTS "estimatedTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiInteraction" ADD COLUMN IF NOT EXISTS "resultStatus" TEXT NOT NULL DEFAULT 'completed';

CREATE TABLE IF NOT EXISTS "Rubric" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Rubric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RubricCriterion" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "maxPoints" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "RubricCriterion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvisingAppointment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "advisorPersonId" TEXT,
    "topic" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AdvisingAppointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SuccessCase" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "summary" TEXT NOT NULL,
    "signalsJson" TEXT NOT NULL DEFAULT '[]',
    "ownerPersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "SuccessCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InterventionTask" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "InterventionTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CourseCorequisite" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "corequisiteCourseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CourseCorequisite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TransferCredit" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT,
    "externalCode" TEXT NOT NULL,
    "externalTitle" TEXT NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "TransferCredit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CourseOffering" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "termCode" TEXT NOT NULL,
    "termName" TEXT NOT NULL,
    "seatsOpen" INTEGER NOT NULL DEFAULT 0,
    "seatsTotal" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CareerOpportunity" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "employerName" TEXT NOT NULL,
    "skillsJson" TEXT NOT NULL DEFAULT '[]',
    "programCodesJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'open',
    "href" TEXT NOT NULL DEFAULT '/student/f/st-20-career',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CareerOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Assignment_rubricId_idx" ON "Assignment"("rubricId");
CREATE INDEX IF NOT EXISTS "AiInteraction_institutionId_capability_createdAt_idx" ON "AiInteraction"("institutionId", "capability", "createdAt");
CREATE INDEX IF NOT EXISTS "Rubric_institutionId_status_idx" ON "Rubric"("institutionId", "status");
CREATE INDEX IF NOT EXISTS "RubricCriterion_institutionId_rubricId_idx" ON "RubricCriterion"("institutionId", "rubricId");
CREATE INDEX IF NOT EXISTS "AdvisingAppointment_institutionId_studentId_startsAt_idx" ON "AdvisingAppointment"("institutionId", "studentId", "startsAt");
CREATE INDEX IF NOT EXISTS "AdvisingAppointment_institutionId_status_idx" ON "AdvisingAppointment"("institutionId", "status");
CREATE INDEX IF NOT EXISTS "SuccessCase_institutionId_studentId_status_idx" ON "SuccessCase"("institutionId", "studentId", "status");
CREATE INDEX IF NOT EXISTS "SuccessCase_institutionId_status_idx" ON "SuccessCase"("institutionId", "status");
CREATE INDEX IF NOT EXISTS "InterventionTask_institutionId_caseId_idx" ON "InterventionTask"("institutionId", "caseId");
CREATE UNIQUE INDEX IF NOT EXISTS "CourseCorequisite_institutionId_courseId_corequisiteCourseId_key" ON "CourseCorequisite"("institutionId", "courseId", "corequisiteCourseId");
CREATE INDEX IF NOT EXISTS "CourseCorequisite_institutionId_idx" ON "CourseCorequisite"("institutionId");
CREATE INDEX IF NOT EXISTS "TransferCredit_institutionId_studentId_idx" ON "TransferCredit"("institutionId", "studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CourseOffering_institutionId_courseId_termCode_key" ON "CourseOffering"("institutionId", "courseId", "termCode");
CREATE INDEX IF NOT EXISTS "CourseOffering_institutionId_termCode_idx" ON "CourseOffering"("institutionId", "termCode");
CREATE INDEX IF NOT EXISTS "CareerOpportunity_institutionId_status_idx" ON "CareerOpportunity"("institutionId", "status");

DO $$ BEGIN
  ALTER TABLE "RubricCriterion" ADD CONSTRAINT "RubricCriterion_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "Rubric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "Rubric"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AdvisingAppointment" ADD CONSTRAINT "AdvisingAppointment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SuccessCase" ADD CONSTRAINT "SuccessCase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InterventionTask" ADD CONSTRAINT "InterventionTask_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SuccessCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseCorequisite" ADD CONSTRAINT "CourseCorequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseCorequisite" ADD CONSTRAINT "CourseCorequisite_corequisiteCourseId_fkey" FOREIGN KEY ("corequisiteCourseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TransferCredit" ADD CONSTRAINT "TransferCredit_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TransferCredit" ADD CONSTRAINT "TransferCredit_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
