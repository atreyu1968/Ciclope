-- Configuración institucional editable por centro para las cuatro redes.
CREATE TABLE "CenterNetworkConfig" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "description" TEXT,
    "institutionalObjectives" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CenterNetworkConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CenterNetworkConfig_centerId_networkId_key"
ON "CenterNetworkConfig"("centerId", "networkId");

CREATE INDEX "CenterNetworkConfig_networkId_idx"
ON "CenterNetworkConfig"("networkId");

ALTER TABLE "CenterNetworkConfig"
ADD CONSTRAINT "CenterNetworkConfig_centerId_fkey"
FOREIGN KEY ("centerId") REFERENCES "Center"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CenterNetworkConfig"
ADD CONSTRAINT "CenterNetworkConfig_networkId_fkey"
FOREIGN KEY ("networkId") REFERENCES "Network"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
