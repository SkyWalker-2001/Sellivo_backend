-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'delivery';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "deliveryOtp" TEXT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
