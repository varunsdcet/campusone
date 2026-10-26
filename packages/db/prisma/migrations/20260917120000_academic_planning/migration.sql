-- Academic planning + AI advisor foundation
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "awardLevel" TEXT NOT NULL DEFAULT 'diploma',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgramVersion" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "effectiveOn" TEXT NOT NULL,
    "totalCredits" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ProgramVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DegreeRequirement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programVersionId" TEXT NOT NULL,
    "courseId" TEXT,
    "courseCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'required',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "DegreeRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoursePrerequisite" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "prerequisiteCourseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DegreePlanScenario" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "assumptionsJson" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "DegreePlanScenario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL DEFAULT '1',
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Student" ADD COLUMN "programVersionId" TEXT;

CREATE UNIQUE INDEX "Program_institutionId_code_key" ON "Program"("institutionId", "code");
CREATE INDEX "Program_institutionId_idx" ON "Program"("institutionId");

CREATE UNIQUE INDEX "ProgramVersion_institutionId_programId_label_key" ON "ProgramVersion"("institutionId", "programId", "label");
CREATE INDEX "ProgramVersion_institutionId_idx" ON "ProgramVersion"("institutionId");

CREATE INDEX "DegreeRequirement_institutionId_programVersionId_idx" ON "DegreeRequirement"("institutionId", "programVersionId");
CREATE INDEX "DegreeRequirement_institutionId_courseCode_idx" ON "DegreeRequirement"("institutionId", "courseCode");

CREATE UNIQUE INDEX "CoursePrerequisite_institutionId_courseId_prerequisiteCourseId_key" ON "CoursePrerequisite"("institutionId", "courseId", "prerequisiteCourseId");
CREATE INDEX "CoursePrerequisite_institutionId_idx" ON "CoursePrerequisite"("institutionId");

CREATE INDEX "DegreePlanScenario_institutionId_studentId_createdAt_idx" ON "DegreePlanScenario"("institutionId", "studentId", "createdAt");

CREATE UNIQUE INDEX "KnowledgeDocument_institutionId_slug_key" ON "KnowledgeDocument"("institutionId", "slug");
CREATE INDEX "KnowledgeDocument_institutionId_docType_idx" ON "KnowledgeDocument"("institutionId", "docType");

CREATE INDEX "Student_programVersionId_idx" ON "Student"("programVersionId");

ALTER TABLE "ProgramVersion" ADD CONSTRAINT "ProgramVersion_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DegreeRequirement" ADD CONSTRAINT "DegreeRequirement_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DegreeRequirement" ADD CONSTRAINT "DegreeRequirement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_prerequisiteCourseId_fkey" FOREIGN KEY ("prerequisiteCourseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DegreePlanScenario" ADD CONSTRAINT "DegreePlanScenario_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
