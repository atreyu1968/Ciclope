-- Annual planning per network and academic year

CREATE TYPE "AnnualPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE "PlanObjectiveStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PlanTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');
CREATE TYPE "PlanMetric" AS ENUM ('ACTIONS', 'PARTICIPATIONS', 'HOURS', 'EVIDENCE');

CREATE TABLE "AnnualPlan" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "AnnualPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnnualPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanObjective" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metric" "PlanMetric",
    "targetValue" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "PlanObjectiveStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanObjective_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanTask" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "objectiveId" TEXT,
    "ownerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "PlanTaskStatus" NOT NULL DEFAULT 'TODO',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlanTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionObjective" (
    "actionId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    CONSTRAINT "ActionObjective_pkey" PRIMARY KEY ("actionId","objectiveId")
);

CREATE UNIQUE INDEX "AnnualPlan_academicYearId_networkId_key"
ON "AnnualPlan"("academicYearId","networkId");

CREATE INDEX "AnnualPlan_academicYearId_status_idx"
ON "AnnualPlan"("academicYearId","status");

CREATE INDEX "PlanObjective_planId_sortOrder_idx"
ON "PlanObjective"("planId","sortOrder");

CREATE INDEX "PlanTask_planId_status_idx"
ON "PlanTask"("planId","status");

CREATE INDEX "PlanTask_ownerId_dueDate_idx"
ON "PlanTask"("ownerId","dueDate");

CREATE INDEX "PlanTask_dueDate_status_idx"
ON "PlanTask"("dueDate","status");

CREATE INDEX "ActionObjective_objectiveId_idx"
ON "ActionObjective"("objectiveId");

ALTER TABLE "AnnualPlan"
ADD CONSTRAINT "AnnualPlan_academicYearId_fkey"
FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AnnualPlan"
ADD CONSTRAINT "AnnualPlan_networkId_fkey"
FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlanObjective"
ADD CONSTRAINT "PlanObjective_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "AnnualPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanTask"
ADD CONSTRAINT "PlanTask_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "AnnualPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanTask"
ADD CONSTRAINT "PlanTask_objectiveId_fkey"
FOREIGN KEY ("objectiveId") REFERENCES "PlanObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlanTask"
ADD CONSTRAINT "PlanTask_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ActionObjective"
ADD CONSTRAINT "ActionObjective_actionId_fkey"
FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionObjective"
ADD CONSTRAINT "ActionObjective_objectiveId_fkey"
FOREIGN KEY ("objectiveId") REFERENCES "PlanObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
