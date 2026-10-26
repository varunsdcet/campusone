ALTER TABLE "AiInteraction"
ADD COLUMN "feedback" TEXT;

ALTER TABLE "AiInteraction"
ADD CONSTRAINT "AiInteraction_feedback_check"
CHECK ("feedback" IS NULL OR "feedback" IN ('up', 'down'));
