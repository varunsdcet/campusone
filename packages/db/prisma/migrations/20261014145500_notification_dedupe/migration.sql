ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;

-- Retain one notification from every historical duplicate group, preferring a
-- row the user has already read, and remove the sweep-created copies.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY "institutionId", "recipientAccountId", "templateKey", title, body
           ORDER BY ("readAt" IS NOT NULL) DESC, "createdAt" ASC, id ASC
         ) AS rn
  FROM "Notification"
  WHERE "templateKey" LIKE 'compliance.%'
)
DELETE FROM "Notification" n
USING ranked r
WHERE n.id = r.id AND r.rn > 1;

UPDATE "Notification"
SET "dedupeKey" = md5(COALESCE("templateKey", '') || E'\\x1f' || title || E'\\x1f' || body)
WHERE "templateKey" LIKE 'compliance.%';

CREATE UNIQUE INDEX "Notification_institutionId_recipientAccountId_dedupeKey_key"
  ON "Notification"("institutionId", "recipientAccountId", "dedupeKey");
