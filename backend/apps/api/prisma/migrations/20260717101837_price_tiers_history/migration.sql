-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "deliveryCents" INTEGER,
ADD COLUMN     "memberCents" INTEGER,
ADD COLUMN     "offerCents" INTEGER,
ADD COLUMN     "wholesaleCents" INTEGER;

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldCents" INTEGER,
    "newCents" INTEGER,
    "scope" TEXT NOT NULL DEFAULT 'all',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_history_variantId_createdAt_idx" ON "price_history"("variantId", "createdAt");

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
