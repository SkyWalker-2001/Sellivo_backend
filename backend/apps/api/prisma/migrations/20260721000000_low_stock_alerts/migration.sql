-- AlterTable: per-store low-stock alert threshold (nullable = no alert)
ALTER TABLE "inventory" ADD COLUMN "lowStockThreshold" INTEGER;

-- CreateTable: owner-facing low-stock alerts
CREATE TABLE "stock_alerts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "onHand" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_alerts_organizationId_resolvedAt_idx" ON "stock_alerts"("organizationId", "resolvedAt");

-- CreateIndex
CREATE INDEX "stock_alerts_storeId_variantId_idx" ON "stock_alerts"("storeId", "variantId");
