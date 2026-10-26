-- Heritage master screen records + audit trail
CREATE TABLE IF NOT EXISTS "HeritageRecord" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "screenId" TEXT NOT NULL,
  "contextKey" TEXT NOT NULL DEFAULT '',
  "singletonKey" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "dataJson" TEXT NOT NULL DEFAULT '{}',
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "HeritageRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HeritageRecord_institutionId_screenId_contextKey_singletonKey_key" ON "HeritageRecord"("institutionId", "screenId", "contextKey", "singletonKey");
CREATE INDEX IF NOT EXISTS "HeritageRecord_institutionId_screenId_contextKey_idx" ON "HeritageRecord"("institutionId", "screenId", "contextKey");

CREATE TABLE IF NOT EXISTS "HeritageAuditEntry" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "screenId" TEXT NOT NULL,
  "contextKey" TEXT NOT NULL DEFAULT '',
  "recordId" TEXT,
  "action" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL DEFAULT '',
  "beforeJson" TEXT,
  "afterJson" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HeritageAuditEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HeritageAuditEntry_institutionId_screenId_createdAt_idx" ON "HeritageAuditEntry"("institutionId", "screenId", "createdAt");
CREATE INDEX IF NOT EXISTS "HeritageAuditEntry_institutionId_contextKey_createdAt_idx" ON "HeritageAuditEntry"("institutionId", "contextKey", "createdAt");
CREATE INDEX IF NOT EXISTS "HeritageAuditEntry_recordId_idx" ON "HeritageAuditEntry"("recordId");
