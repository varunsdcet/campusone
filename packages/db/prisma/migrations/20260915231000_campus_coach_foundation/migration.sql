-- CreateTable
CREATE TABLE "AiInteraction" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sourcesJson" TEXT NOT NULL,
    "suggestedActionsJson" TEXT NOT NULL DEFAULT '[]',
    "tier" TEXT NOT NULL DEFAULT 'read_only',
    "provider" TEXT NOT NULL DEFAULT 'campus_grounding_v1',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AiInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiInteraction_institutionId_accountId_createdAt_idx" ON "AiInteraction"("institutionId", "accountId", "createdAt");

-- CreateIndex
CREATE INDEX "AiInteraction_institutionId_role_createdAt_idx" ON "AiInteraction"("institutionId", "role", "createdAt");

-- AddForeignKey
ALTER TABLE "AiInteraction" ADD CONSTRAINT "AiInteraction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
