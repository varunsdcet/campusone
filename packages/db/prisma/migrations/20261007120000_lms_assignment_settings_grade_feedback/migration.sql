-- Course workspace assignments keep their submission rules; grade items carry instructor feedback
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "instructions" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "availableFrom" TIMESTAMP(3);
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "cutoffAt" TIMESTAMP(3);
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "maxFiles" INTEGER;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "maxFileBytes" INTEGER;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "acceptedTypes" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "fileSubmissions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "onlineText" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "textBody" TEXT;
ALTER TABLE "GradeItem" ADD COLUMN IF NOT EXISTS "feedback" TEXT;
