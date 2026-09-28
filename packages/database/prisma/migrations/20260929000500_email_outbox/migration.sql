-- PostgreSQL-backed email outbox

CREATE TYPE "EmailOutboxStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT,
    "userId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "status" "EmailOutboxStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailOutbox_status_nextAttemptAt_idx"
ON "EmailOutbox"("status","nextAttemptAt");

CREATE INDEX "EmailOutbox_communicationId_idx"
ON "EmailOutbox"("communicationId");

CREATE INDEX "EmailOutbox_userId_idx"
ON "EmailOutbox"("userId");

ALTER TABLE "EmailOutbox"
ADD CONSTRAINT "EmailOutbox_communicationId_fkey"
FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailOutbox"
ADD CONSTRAINT "EmailOutbox_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
