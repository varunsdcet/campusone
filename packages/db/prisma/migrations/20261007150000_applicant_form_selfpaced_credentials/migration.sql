-- Applicant wizard answers (personal details, academic history, program choice)
ALTER TABLE "AdmissionsApplication" ADD COLUMN IF NOT EXISTS "formJson" TEXT NOT NULL DEFAULT '{}';

-- Self-paced certificates are issued once per learner and course
ALTER TABLE "CredentialRecord" ADD COLUMN IF NOT EXISTS "sourceKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "CredentialRecord_studentId_sourceKey_key" ON "CredentialRecord"("studentId", "sourceKey");
