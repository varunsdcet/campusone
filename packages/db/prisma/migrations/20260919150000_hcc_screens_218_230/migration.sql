-- ALTER TABLE for HCC mail + course resources + badges (screens 218-230)

ALTER TABLE "MessageThread" ADD COLUMN IF NOT EXISTS "messageType" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "MessageThread" ADD COLUMN IF NOT EXISTS "ccAccountIdsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "MessageThread" ADD COLUMN IF NOT EXISTS "bccAccountIdsJson" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "MailThreadPlacement" ADD COLUMN IF NOT EXISTS "flagged" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MailboxSettings" ADD COLUMN IF NOT EXISTS "autoResponderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MailboxSettings" ADD COLUMN IF NOT EXISTS "autoResponderBody" TEXT;

CREATE TABLE IF NOT EXISTS "MailDistributionList" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "memberAccountIdsJson" TEXT NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "MailDistributionList_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MailDistributionList_institutionId_accountId_idx"
  ON "MailDistributionList"("institutionId", "accountId");

CREATE TABLE IF NOT EXISTS "CourseResourceCategory" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'English',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "CourseResourceCategory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CourseResourceCategory_institutionId_idx"
  ON "CourseResourceCategory"("institutionId");

CREATE TABLE IF NOT EXISTS "CourseResource" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "categoryId" TEXT,
  "courseId" TEXT,
  "name" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'English',
  "allowQuantities" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "CourseResource_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CourseResource_institutionId_idx" ON "CourseResource"("institutionId");
CREATE INDEX IF NOT EXISTS "CourseResource_categoryId_idx" ON "CourseResource"("categoryId");
CREATE INDEX IF NOT EXISTS "CourseResource_courseId_idx" ON "CourseResource"("courseId");

DO $$ BEGIN
  ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "CourseResourceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BadgeDefinition" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "badgeText" TEXT NOT NULL DEFAULT '',
  "imageUrl" TEXT,
  "approvalMode" TEXT NOT NULL DEFAULT 'Instant / Automated',
  "badgeType" TEXT NOT NULL DEFAULT 'Designation / Academic Performance',
  "programsRule" TEXT NOT NULL DEFAULT 'All Programs',
  "coursesRule" TEXT NOT NULL DEFAULT 'Any',
  "termsRule" TEXT NOT NULL DEFAULT 'Any',
  "averageType" TEXT NOT NULL DEFAULT 'None',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "BadgeDefinition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BadgeDefinition_institutionId_idx" ON "BadgeDefinition"("institutionId");
