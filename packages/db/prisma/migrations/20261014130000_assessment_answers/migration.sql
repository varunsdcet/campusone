ALTER TABLE "Assessment" ADD COLUMN "questionsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "AssessmentAttempt" ADD COLUMN "answersJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "AssessmentAttempt" ADD COLUMN "score" DOUBLE PRECISION;
ALTER TABLE "AssessmentAttempt" ADD COLUMN "maxScore" DOUBLE PRECISION;
