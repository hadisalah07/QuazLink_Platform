-- CreateTable
CREATE TABLE IF NOT EXISTS "PosTerminal" (
    "id" TEXT NOT NULL,
    "hardwareId" TEXT NOT NULL,
    "hostname" TEXT,
    "username" TEXT,
    "osPlatform" TEXT,
    "osRelease" TEXT,
    "osArch" TEXT,
    "cpuModel" TEXT,
    "totalMemoryMB" INTEGER,
    "appVersion" TEXT DEFAULT '1.1.0',
    "businessName" TEXT DEFAULT 'Retail Store',
    "licenseType" TEXT DEFAULT 'trial',
    "licenseKey" TEXT,
    "ipAddress" TEXT,
    "country" TEXT,
    "city" TEXT,
    "countryCode" TEXT,
    "launchCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosTerminal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PosTerminal_hardwareId_key" ON "PosTerminal"("hardwareId");
