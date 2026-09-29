-- Per-center configuration for Resend and AI integrations
CREATE TABLE "CenterIntegrationSettings" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "resendEnabled" BOOLEAN NOT NULL DEFAULT false,
  "resendApiKeyEncrypted" TEXT,
  "resendFromEmail" TEXT,
  "resendFromName" TEXT,
  "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
  "aiProviderName" TEXT,
  "aiBaseUrl" TEXT,
  "aiModel" TEXT,
  "aiApiKeyEncrypted" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CenterIntegrationSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CenterIntegrationSettings_centerId_key"
ON "CenterIntegrationSettings"("centerId");

ALTER TABLE "CenterIntegrationSettings"
ADD CONSTRAINT "CenterIntegrationSettings_centerId_fkey"
FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
