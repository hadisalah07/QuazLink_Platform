-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginIp" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;

-- AlterTable
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;

-- Ensure super admin role for master account
UPDATE "User" SET "role" = 'admin' WHERE LOWER("email") = 'hadisalah07@gmail.com';
