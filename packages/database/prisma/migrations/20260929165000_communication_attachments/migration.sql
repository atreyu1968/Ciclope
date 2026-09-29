CREATE TABLE "CommunicationAttachment" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunicationAttachment_communicationId_idx"
ON "CommunicationAttachment"("communicationId");

CREATE INDEX "CommunicationAttachment_uploadedById_idx"
ON "CommunicationAttachment"("uploadedById");

ALTER TABLE "CommunicationAttachment"
ADD CONSTRAINT "CommunicationAttachment_communicationId_fkey"
FOREIGN KEY ("communicationId") REFERENCES "Communication"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunicationAttachment"
ADD CONSTRAINT "CommunicationAttachment_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
