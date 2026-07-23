-- AlterTable
ALTER TABLE "customers" ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN "ownerNote" TEXT;
