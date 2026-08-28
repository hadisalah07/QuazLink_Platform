-- AlterTable: columns that db push added but no migration recorded
ALTER TABLE "SocialAccount" ADD COLUMN "destinations" JSONB;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN "targetUrl" TEXT;

-- CreateTable
CREATE TABLE "Catalog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'custom',
    "apiUrl" TEXT NOT NULL,
    "apiKey" TEXT,
    "authScheme" TEXT NOT NULL DEFAULT 'bearer',
    "authHeader" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Workstation',
    "platform" TEXT NOT NULL DEFAULT 'win32',
    "pairingToken" TEXT NOT NULL,
    "deviceToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "ipAddress" TEXT,
    "appVersion" TEXT,
    "lastHeartbeat" TIMESTAMP(3),
    "keepAwake" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_pairingToken_key" ON "Device"("pairingToken");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceToken_key" ON "Device"("deviceToken");

-- AddForeignKey
ALTER TABLE "Catalog" ADD CONSTRAINT "Catalog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
