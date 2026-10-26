CREATE TABLE "StudyPlan" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsOn" TEXT NOT NULL,
  "endsOn" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "StudySession" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "planId" TEXT,
  "sectionId" TEXT,
  "assignmentId" TEXT,
  "title" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudySession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudySession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudySession_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudySession_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "FocusSession" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "studySessionId" TEXT,
  "title" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FocusSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FocusSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FocusSession_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "StudySession"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AiPlannerRun" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "inputSnapshotJson" TEXT NOT NULL,
  "outputJson" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiPlannerRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiPlannerRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiPlannerRun_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StudyPlan_institutionId_studentId_status_idx" ON "StudyPlan"("institutionId", "studentId", "status");
CREATE INDEX "StudyPlan_studentId_startsOn_endsOn_idx" ON "StudyPlan"("studentId", "startsOn", "endsOn");
CREATE INDEX "StudySession_institutionId_studentId_scheduledAt_idx" ON "StudySession"("institutionId", "studentId", "scheduledAt");
CREATE INDEX "StudySession_planId_idx" ON "StudySession"("planId");
CREATE INDEX "FocusSession_institutionId_studentId_startedAt_idx" ON "FocusSession"("institutionId", "studentId", "startedAt");
CREATE INDEX "AiPlannerRun_institutionId_accountId_createdAt_idx" ON "AiPlannerRun"("institutionId", "accountId", "createdAt");
CREATE INDEX "AiPlannerRun_institutionId_studentId_status_idx" ON "AiPlannerRun"("institutionId", "studentId", "status");
