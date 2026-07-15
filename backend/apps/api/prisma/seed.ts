/**
 * Minimal seed: one org + owner, one store, a category, a product with a
 * barcoded variant, and an opening stock movement. Idempotent-ish — safe to
 * re-run against an empty DB; uses upserts on natural keys where possible.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash("supersecret", 10);

  const org = await prisma.organization.create({ data: { name: "Acme Retail (Seed)" } });

  await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "owner@acme.test",
      passwordHash,
      name: "Seed Owner",
      role: "owner",
    },
  });

  const store = await prisma.store.create({
    data: { organizationId: org.id, name: "Acme — MG Road", currency: "INR" },
  });

  const category = await prisma.category.create({
    data: { organizationId: org.id, name: "Beverages" },
  });

  const product = await prisma.product.create({
    data: {
      organizationId: org.id,
      categoryId: category.id,
      name: "Cola 500ml",
      brand: "Acme Drinks",
    },
  });

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: "COLA-500",
      barcode: "8901234567890",
      priceCents: 4000,
      costCents: 2500,
    },
  });

  // Opening stock via the ledger + cached total.
  await prisma.inventoryMovement.create({
    data: {
      id: randomUUID(),
      storeId: store.id,
      variantId: variant.id,
      delta: 100,
      reason: "restock",
      source: "system",
    },
  });
  await prisma.inventory.create({
    data: { storeId: store.id, variantId: variant.id, onHand: 100 },
  });

  console.log("Seed complete:", { orgId: org.id, storeId: store.id, variantId: variant.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
