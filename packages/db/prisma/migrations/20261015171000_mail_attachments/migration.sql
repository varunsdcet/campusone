CREATE TABLE "MessageAttachment" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "contentBase64" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessageAttachment_institutionId_messageId_idx"
ON "MessageAttachment"("institutionId", "messageId");

ALTER TABLE "MessageAttachment"
ADD CONSTRAINT "MessageAttachment_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
