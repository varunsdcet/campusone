-- Campus compliance cases + session join telemetry
CREATE TABLE IF NOT EXISTS "ComplianceCase" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectRef" TEXT NOT NULL,
  "caseKind" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'warning',
  "status" TEXT NOT NULL DEFAULT 'open',
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL DEFAULT '',
  "missCount" INTEGER NOT NULL DEFAULT 0,
  "explanation" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "metaJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ComplianceCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ComplianceCase_institutionId_status_idx" ON "ComplianceCase"("institutionId", "status");
CREATE INDEX IF NOT EXISTS "ComplianceCase_institutionId_caseKind_status_idx" ON "ComplianceCase"("institutionId", "caseKind", "status");
CREATE INDEX IF NOT EXISTS "ComplianceCase_subjectType_subjectRef_idx" ON "ComplianceCase"("subjectType", "subjectRef");

CREATE TABLE IF NOT EXISTS "SessionJoinEvent" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "classSessionId" TEXT NOT NULL,
  "studentId" TEXT,
  "accountId" TEXT,
  "clientKind" TEXT NOT NULL DEFAULT 'unknown',
  "userAgent" TEXT NOT NULL DEFAULT '',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "SessionJoinEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SessionJoinEvent_institutionId_joinedAt_idx" ON "SessionJoinEvent"("institutionId", "joinedAt");
CREATE INDEX IF NOT EXISTS "SessionJoinEvent_classSessionId_joinedAt_idx" ON "SessionJoinEvent"("classSessionId", "joinedAt");
CREATE INDEX IF NOT EXISTS "SessionJoinEvent_studentId_joinedAt_idx" ON "SessionJoinEvent"("studentId", "joinedAt");
