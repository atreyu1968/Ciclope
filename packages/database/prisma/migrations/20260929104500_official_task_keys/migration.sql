ALTER TABLE "PlanTask"
ADD COLUMN "officialKey" TEXT;

CREATE UNIQUE INDEX "PlanTask_planId_officialKey_key"
ON "PlanTask"("planId","officialKey");
