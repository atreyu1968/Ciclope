-- Bidirectional staff inbox for proposals, queries and needs

CREATE TYPE "StaffRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "StaffRequest" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "StaffRequestStatus" NOT NULL DEFAULT 'NEW',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffRequestNetwork" (
    "requestId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    CONSTRAINT "StaffRequestNetwork_pkey" PRIMARY KEY ("requestId","networkId")
);

CREATE TABLE "StaffRequestMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffRequestMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffRequest_academicYearId_status_idx"
ON "StaffRequest"("academicYearId","status");

CREATE INDEX "StaffRequest_submittedById_academicYearId_idx"
ON "StaffRequest"("submittedById","academicYearId");

CREATE INDEX "StaffRequestNetwork_networkId_idx"
ON "StaffRequestNetwork"("networkId");

CREATE INDEX "StaffRequestMessage_requestId_createdAt_idx"
ON "StaffRequestMessage"("requestId","createdAt");

CREATE INDEX "StaffRequestMessage_authorId_idx"
ON "StaffRequestMessage"("authorId");

ALTER TABLE "StaffRequest"
ADD CONSTRAINT "StaffRequest_academicYearId_fkey"
FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffRequest"
ADD CONSTRAINT "StaffRequest_submittedById_fkey"
FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffRequestNetwork"
ADD CONSTRAINT "StaffRequestNetwork_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "StaffRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffRequestNetwork"
ADD CONSTRAINT "StaffRequestNetwork_networkId_fkey"
FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffRequestMessage"
ADD CONSTRAINT "StaffRequestMessage_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "StaffRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffRequestMessage"
ADD CONSTRAINT "StaffRequestMessage_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
