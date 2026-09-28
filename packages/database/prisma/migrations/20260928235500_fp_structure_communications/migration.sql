-- FP structure, group catalogue and asynchronous communication recipients

CREATE TYPE "Shift" AS ENUM ('MORNING', 'AFTERNOON', 'BOTH', 'UNSPECIFIED');
CREATE TYPE "CommunicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "User"
ADD COLUMN "shift" "Shift" NOT NULL DEFAULT 'UNSPECIFIED';

ALTER TABLE "Communication"
ADD COLUMN "authorId" TEXT,
ADD COLUMN "originNetworkId" TEXT,
ADD COLUMN "status" "CommunicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "ProfessionalFamily" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProfessionalFamily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProfessionalFamily" (
    "userId" TEXT NOT NULL,
    "professionalFamilyId" TEXT NOT NULL,
    CONSTRAINT "UserProfessionalFamily_pkey" PRIMARY KEY ("userId","professionalFamilyId")
);

CREATE TABLE "TeachingGroup" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "professionalFamilyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shift" "Shift" NOT NULL DEFAULT 'UNSPECIFIED',
    "studentCount" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeachingGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionTeachingGroup" (
    "actionId" TEXT NOT NULL,
    "teachingGroupId" TEXT NOT NULL,
    CONSTRAINT "ActionTeachingGroup_pkey" PRIMARY KEY ("actionId","teachingGroupId")
);

CREATE TABLE "CommunicationRecipient" (
    "communicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "responseText" TEXT,
    CONSTRAINT "CommunicationRecipient_pkey" PRIMARY KEY ("communicationId","userId")
);

CREATE UNIQUE INDEX "ProfessionalFamily_centerId_name_key"
ON "ProfessionalFamily"("centerId","name");

CREATE UNIQUE INDEX "ProfessionalFamily_centerId_code_key"
ON "ProfessionalFamily"("centerId","code");

CREATE INDEX "ProfessionalFamily_centerId_active_idx"
ON "ProfessionalFamily"("centerId","active");

CREATE INDEX "UserProfessionalFamily_professionalFamilyId_idx"
ON "UserProfessionalFamily"("professionalFamilyId");

CREATE UNIQUE INDEX "TeachingGroup_academicYearId_name_key"
ON "TeachingGroup"("academicYearId","name");

CREATE INDEX "TeachingGroup_academicYearId_professionalFamilyId_idx"
ON "TeachingGroup"("academicYearId","professionalFamilyId");

CREATE INDEX "ActionTeachingGroup_teachingGroupId_idx"
ON "ActionTeachingGroup"("teachingGroupId");

CREATE INDEX "Communication_academicYearId_status_idx"
ON "Communication"("academicYearId","status");

CREATE INDEX "Communication_originNetworkId_idx"
ON "Communication"("originNetworkId");

CREATE INDEX "Communication_authorId_idx"
ON "Communication"("authorId");

CREATE INDEX "CommunicationRecipient_userId_readAt_idx"
ON "CommunicationRecipient"("userId","readAt");

ALTER TABLE "ProfessionalFamily"
ADD CONSTRAINT "ProfessionalFamily_centerId_fkey"
FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserProfessionalFamily"
ADD CONSTRAINT "UserProfessionalFamily_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserProfessionalFamily"
ADD CONSTRAINT "UserProfessionalFamily_professionalFamilyId_fkey"
FOREIGN KEY ("professionalFamilyId") REFERENCES "ProfessionalFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeachingGroup"
ADD CONSTRAINT "TeachingGroup_academicYearId_fkey"
FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeachingGroup"
ADD CONSTRAINT "TeachingGroup_professionalFamilyId_fkey"
FOREIGN KEY ("professionalFamilyId") REFERENCES "ProfessionalFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActionTeachingGroup"
ADD CONSTRAINT "ActionTeachingGroup_actionId_fkey"
FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionTeachingGroup"
ADD CONSTRAINT "ActionTeachingGroup_teachingGroupId_fkey"
FOREIGN KEY ("teachingGroupId") REFERENCES "TeachingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Communication"
ADD CONSTRAINT "Communication_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Communication"
ADD CONSTRAINT "Communication_originNetworkId_fkey"
FOREIGN KEY ("originNetworkId") REFERENCES "Network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunicationRecipient"
ADD CONSTRAINT "CommunicationRecipient_communicationId_fkey"
FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunicationRecipient"
ADD CONSTRAINT "CommunicationRecipient_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
