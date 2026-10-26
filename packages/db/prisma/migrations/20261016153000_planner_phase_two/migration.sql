CREATE TABLE "StudyGoal" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "targetDate" TEXT,
  "weeklyTargetMinutes" INTEGER NOT NULL DEFAULT 300,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "StudyGoal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyGoal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "StudyArtifact" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sourceJson" TEXT NOT NULL DEFAULT '[]',
  "contentJson" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "StudyArtifact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudyArtifact_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudyArtifact_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "OpportunityBookmark" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunityBookmark_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OpportunityBookmark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OpportunityBookmark_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CareerOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CalendarConnection" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'device',
  "mode" TEXT NOT NULL DEFAULT 'read_only_export',
  "status" TEXT NOT NULL DEFAULT 'active',
  "lastExportedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarConnection_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StudyGoal_institutionId_studentId_status_idx" ON "StudyGoal"("institutionId", "studentId", "status");
CREATE INDEX "StudyArtifact_institutionId_studentId_createdAt_idx" ON "StudyArtifact"("institutionId", "studentId", "createdAt");
CREATE INDEX "StudyArtifact_sectionId_kind_idx" ON "StudyArtifact"("sectionId", "kind");
CREATE UNIQUE INDEX "OpportunityBookmark_studentId_opportunityId_key" ON "OpportunityBookmark"("studentId", "opportunityId");
CREATE INDEX "OpportunityBookmark_institutionId_studentId_createdAt_idx" ON "OpportunityBookmark"("institutionId", "studentId", "createdAt");
CREATE UNIQUE INDEX "CalendarConnection_studentId_provider_key" ON "CalendarConnection"("studentId", "provider");
CREATE INDEX "CalendarConnection_institutionId_studentId_status_idx" ON "CalendarConnection"("institutionId", "studentId", "status");
