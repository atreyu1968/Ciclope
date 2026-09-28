-- Authentication, academic-year coordination and action audit fields

ALTER TABLE "AcademicYear"
ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Action"
ADD COLUMN "submittedById" TEXT,
ADD COLUMN "validatedById" TEXT,
ADD COLUMN "returnedAt" TIMESTAMP(3),
ADD COLUMN "returnedReason" TEXT;

ALTER TABLE "Communication"
ADD COLUMN "academicYearId" TEXT;

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NetworkCoordinator" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NetworkCoordinator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CiclopeCoordinator" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CiclopeCoordinator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE UNIQUE INDEX "NetworkCoordinator_academicYearId_networkId_userId_key"
ON "NetworkCoordinator"("academicYearId","networkId","userId");
CREATE INDEX "NetworkCoordinator_academicYearId_networkId_idx"
ON "NetworkCoordinator"("academicYearId","networkId");
CREATE INDEX "NetworkCoordinator_userId_academicYearId_idx"
ON "NetworkCoordinator"("userId","academicYearId");
CREATE UNIQUE INDEX "CiclopeCoordinator_academicYearId_userId_key"
ON "CiclopeCoordinator"("academicYearId","userId");
CREATE INDEX "CiclopeCoordinator_academicYearId_idx"
ON "CiclopeCoordinator"("academicYearId");
CREATE INDEX "CiclopeCoordinator_userId_academicYearId_idx"
ON "CiclopeCoordinator"("userId","academicYearId");
CREATE INDEX "Action_submittedById_idx" ON "Action"("submittedById");

UPDATE "Communication"
SET "academicYearId" = (
  SELECT "id" FROM "AcademicYear"
  WHERE "isActive" = true
  ORDER BY "startsAt" DESC
  LIMIT 1
)
WHERE "academicYearId" IS NULL;

ALTER TABLE "Communication"
ALTER COLUMN "academicYearId" SET NOT NULL;

CREATE INDEX "Communication_academicYearId_idx" ON "Communication"("academicYearId");

ALTER TABLE "Session"
ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NetworkCoordinator"
ADD CONSTRAINT "NetworkCoordinator_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetworkCoordinator"
ADD CONSTRAINT "NetworkCoordinator_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NetworkCoordinator"
ADD CONSTRAINT "NetworkCoordinator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CiclopeCoordinator"
ADD CONSTRAINT "CiclopeCoordinator_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CiclopeCoordinator"
ADD CONSTRAINT "CiclopeCoordinator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Action"
ADD CONSTRAINT "Action_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Action"
ADD CONSTRAINT "Action_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Communication"
ADD CONSTRAINT "Communication_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
