CREATE TABLE "StudentStatusDefinition" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "parentKey" TEXT,
  "flagsJson" TEXT NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentStatusDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentStatusDefinition_institutionId_key_key" ON "StudentStatusDefinition"("institutionId", "key");
CREATE UNIQUE INDEX "StudentStatusDefinition_id_institutionId_key" ON "StudentStatusDefinition"("id", "institutionId");

CREATE TABLE "StudentLifecycleStatus" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "statusDefinitionId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedById" TEXT,
  CONSTRAINT "StudentLifecycleStatus_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentLifecycleStatus_institutionId_studentId_key" ON "StudentLifecycleStatus"("institutionId", "studentId");
CREATE UNIQUE INDEX "StudentLifecycleStatus_studentId_key" ON "StudentLifecycleStatus"("studentId");
CREATE INDEX "StudentLifecycleStatus_institutionId_statusDefinitionId_idx" ON "StudentLifecycleStatus"("institutionId", "statusDefinitionId");
ALTER TABLE "StudentLifecycleStatus" ADD CONSTRAINT "StudentLifecycleStatus_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentLifecycleStatus" ADD CONSTRAINT "StudentLifecycleStatus_statusDefinitionId_institutionId_fkey" FOREIGN KEY ("statusDefinitionId", "institutionId") REFERENCES "StudentStatusDefinition"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StudentLifecycleStatusHistory" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "statusDefinitionId" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedById" TEXT,
  CONSTRAINT "StudentLifecycleStatusHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudentLifecycleStatusHistory_institutionId_studentId_changedAt_idx" ON "StudentLifecycleStatusHistory"("institutionId", "studentId", "changedAt");
ALTER TABLE "StudentLifecycleStatusHistory" ADD CONSTRAINT "StudentLifecycleStatusHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentLifecycleStatusHistory" ADD CONSTRAINT "StudentLifecycleStatusHistory_statusDefinitionId_institutionId_fkey" FOREIGN KEY ("statusDefinitionId", "institutionId") REFERENCES "StudentStatusDefinition"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AccessLevelDefinition" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "profileType" TEXT NOT NULL,
  "assignableByNonAdmins" BOOLEAN NOT NULL DEFAULT false,
  "permissionsJson" TEXT NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessLevelDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccessLevelDefinition_institutionId_key_key" ON "AccessLevelDefinition"("institutionId", "key");
CREATE UNIQUE INDEX "AccessLevelDefinition_id_institutionId_key" ON "AccessLevelDefinition"("id", "institutionId");

CREATE TABLE "AccountAccessLevelAssignment" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "accessLevelId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedById" TEXT,
  CONSTRAINT "AccountAccessLevelAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccountAccessLevelAssignment_institutionId_accountId_key" ON "AccountAccessLevelAssignment"("institutionId", "accountId");
CREATE UNIQUE INDEX "AccountAccessLevelAssignment_accountId_key" ON "AccountAccessLevelAssignment"("accountId");
CREATE INDEX "AccountAccessLevelAssignment_institutionId_accessLevelId_idx" ON "AccountAccessLevelAssignment"("institutionId", "accessLevelId");
ALTER TABLE "AccountAccessLevelAssignment" ADD CONSTRAINT "AccountAccessLevelAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountAccessLevelAssignment" ADD CONSTRAINT "AccountAccessLevelAssignment_accessLevelId_institutionId_fkey" FOREIGN KEY ("accessLevelId", "institutionId") REFERENCES "AccessLevelDefinition"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AccountAccessLevelHistory" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "accessLevelId" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedById" TEXT,
  CONSTRAINT "AccountAccessLevelHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccountAccessLevelHistory_institutionId_accountId_changedAt_idx" ON "AccountAccessLevelHistory"("institutionId", "accountId", "changedAt");
ALTER TABLE "AccountAccessLevelHistory" ADD CONSTRAINT "AccountAccessLevelHistory_accessLevelId_institutionId_fkey" FOREIGN KEY ("accessLevelId", "institutionId") REFERENCES "AccessLevelDefinition"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill the current lifecycle snapshot from the legacy KV payload. Future
-- changes are dual-written by the API and append a real history row.
WITH raw_status AS (
  SELECT s."institutionId", e.key AS "studentId", e.value->>'status' AS status
  FROM "SisScreenState" s
  CROSS JOIN LATERAL jsonb_each(s."payloadJson"::jsonb) e
  WHERE s.path = 'super:student-meta' AND COALESCE(e.value->>'status', '') <> ''
), normalized AS (
  SELECT DISTINCT "institutionId", status,
    trim(both '-' from regexp_replace(lower(status), '[^a-z0-9]+', '-', 'g')) AS status_key
  FROM raw_status
)
INSERT INTO "StudentStatusDefinition" (id, "institutionId", key, name, "updatedAt")
SELECT md5("institutionId" || ':student-status:' || status_key), "institutionId", status_key, status, CURRENT_TIMESTAMP
FROM normalized
ON CONFLICT ("institutionId", key) DO NOTHING;

WITH raw_status AS (
  SELECT s."institutionId", e.key AS "studentId", e.value->>'status' AS status
  FROM "SisScreenState" s
  CROSS JOIN LATERAL jsonb_each(s."payloadJson"::jsonb) e
  WHERE s.path = 'super:student-meta' AND COALESCE(e.value->>'status', '') <> ''
), resolved AS (
  SELECT r.*, d.id AS "definitionId"
  FROM raw_status r
  JOIN "Student" student ON student.id = r."studentId" AND student."institutionId" = r."institutionId"
  JOIN "StudentStatusDefinition" d ON d."institutionId" = r."institutionId"
    AND d.key = trim(both '-' from regexp_replace(lower(r.status), '[^a-z0-9]+', '-', 'g'))
)
INSERT INTO "StudentLifecycleStatus" (id, "institutionId", "studentId", "statusDefinitionId")
SELECT md5("institutionId" || ':student-status-assignment:' || "studentId"), "institutionId", "studentId", "definitionId"
FROM resolved
ON CONFLICT ("institutionId", "studentId") DO NOTHING;

INSERT INTO "StudentLifecycleStatusHistory" (id, "institutionId", "studentId", "statusDefinitionId")
SELECT md5(a."institutionId" || ':student-status-history:' || a."studentId"), a."institutionId", a."studentId", a."statusDefinitionId"
FROM "StudentLifecycleStatus" a;

-- Normalize stored access-level definitions, then fill any built-in definition
-- referenced by user-meta even when the institution never customized levels.
WITH levels AS (
  SELECT s."institutionId", element.level
  FROM "SisScreenState" s
  CROSS JOIN LATERAL jsonb_array_elements(s."payloadJson"::jsonb) AS element(level)
  WHERE s.path = 'super:access-levels'
)
INSERT INTO "AccessLevelDefinition" (id, "institutionId", key, name, "profileType", "assignableByNonAdmins", "permissionsJson", "updatedAt")
SELECT md5("institutionId" || ':access-level:' || ((level::jsonb)->>'id')), "institutionId", (level::jsonb)->>'id', COALESCE((level::jsonb)->>'name', (level::jsonb)->>'id'), COALESCE((level::jsonb)->>'profileType', 'Staff'), COALESCE(((level::jsonb)->>'assignableByNonAdmins')::boolean, false), COALESCE(((level::jsonb)->'permissions')::text, '{}'), CURRENT_TIMESTAMP
FROM levels
WHERE COALESCE((level::jsonb)->>'id', '') <> ''
ON CONFLICT ("institutionId", key) DO UPDATE SET name = EXCLUDED.name, "profileType" = EXCLUDED."profileType", "permissionsJson" = EXCLUDED."permissionsJson", "updatedAt" = CURRENT_TIMESTAMP;

WITH assigned AS (
  SELECT s."institutionId", e.key AS "accountId", e.value->>'accessLevelId' AS level_key
  FROM "SisScreenState" s
  CROSS JOIN LATERAL jsonb_each(s."payloadJson"::jsonb) e
  WHERE s.path = 'super:user-meta' AND COALESCE(e.value->>'accessLevelId', '') <> ''
)
INSERT INTO "AccessLevelDefinition" (id, "institutionId", key, name, "profileType", "updatedAt")
SELECT DISTINCT md5("institutionId" || ':access-level:' || level_key), "institutionId", level_key, initcap(replace(level_key, '-', ' ')), 'Staff', CURRENT_TIMESTAMP
FROM assigned
ON CONFLICT ("institutionId", key) DO NOTHING;

WITH assigned AS (
  SELECT s."institutionId", e.key AS "accountId", e.value->>'accessLevelId' AS level_key
  FROM "SisScreenState" s
  CROSS JOIN LATERAL jsonb_each(s."payloadJson"::jsonb) e
  WHERE s.path = 'super:user-meta' AND COALESCE(e.value->>'accessLevelId', '') <> ''
)
INSERT INTO "AccountAccessLevelAssignment" (id, "institutionId", "accountId", "accessLevelId")
SELECT md5(a."institutionId" || ':account-access-assignment:' || a."accountId"), a."institutionId", a."accountId", d.id
FROM assigned a
JOIN "Account" account ON account.id = a."accountId" AND account."institutionId" = a."institutionId"
JOIN "AccessLevelDefinition" d ON d."institutionId" = a."institutionId" AND d.key = a.level_key
ON CONFLICT ("institutionId", "accountId") DO NOTHING;

INSERT INTO "AccountAccessLevelHistory" (id, "institutionId", "accountId", "accessLevelId")
SELECT md5(a."institutionId" || ':account-access-history:' || a."accountId"), a."institutionId", a."accountId", a."accessLevelId"
FROM "AccountAccessLevelAssignment" a;
