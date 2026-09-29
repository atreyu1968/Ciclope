CREATE TABLE "AcademicYearMilestone" (
  "id" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "official" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicYearMilestone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcademicYearMilestone_academicYearId_title_dueDate_key"
ON "AcademicYearMilestone"("academicYearId","title","dueDate");

CREATE INDEX "AcademicYearMilestone_academicYearId_dueDate_idx"
ON "AcademicYearMilestone"("academicYearId","dueDate");

ALTER TABLE "AcademicYearMilestone"
ADD CONSTRAINT "AcademicYearMilestone_academicYearId_fkey"
FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
