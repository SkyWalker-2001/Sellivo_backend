-- CreateEnum
CREATE TYPE "LayoutStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "home_layouts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT,
    "status" "LayoutStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layout_sections" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "dataSource" JSONB NOT NULL DEFAULT '{}',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "layout_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_layouts_organizationId_idx" ON "home_layouts"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "home_layouts_organizationId_storeId_status_key" ON "home_layouts"("organizationId", "storeId", "status");

-- CreateIndex
CREATE INDEX "layout_sections_layoutId_position_idx" ON "layout_sections"("layoutId", "position");

-- AddForeignKey
ALTER TABLE "home_layouts" ADD CONSTRAINT "home_layouts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layout_sections" ADD CONSTRAINT "layout_sections_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "home_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
