CREATE TYPE "ReportSnapshotStatus" AS ENUM ('SAVED', 'SUBMITTED');

CREATE TABLE "ReportSnapshot" (
  "id" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "networkId" TEXT,
  "createdById" TEXT,
  "title" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" "ReportSnapshotStatus" NOT NULL DEFAULT 'SAVED',
  "data" JSONB NOT NULL,
  "narrative" TEXT,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportSnapshot_academicYearId_networkId_periodEnd_idx"
ON "ReportSnapshot"("academicYearId","networkId","periodEnd");

CREATE INDEX "ReportSnapshot_createdById_createdAt_idx"
ON "ReportSnapshot"("createdById","createdAt");

CREATE INDEX "ReportSnapshot_status_submittedAt_idx"
ON "ReportSnapshot"("status","submittedAt");

ALTER TABLE "ReportSnapshot"
ADD CONSTRAINT "ReportSnapshot_academicYearId_fkey"
FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportSnapshot"
ADD CONSTRAINT "ReportSnapshot_networkId_fkey"
FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReportSnapshot"
ADD CONSTRAINT "ReportSnapshot_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
