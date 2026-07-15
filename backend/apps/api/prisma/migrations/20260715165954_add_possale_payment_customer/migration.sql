-- AlterTable
ALTER TABLE "pos_sales" ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'cash';
