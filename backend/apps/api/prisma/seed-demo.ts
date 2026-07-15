/**
 * Demo seed — one clearly-labeled shared tenant ("Demo Mart") that every surface
 * (owner app, POS, customer web/app, and the DB itself) reads from the SAME rows.
 *
 * Idempotent: it wipes and recreates the Demo Mart org on every run, so it never
 * piles up duplicate tenants. Safe to run repeatedly.
 *
 * Login (all users share one password):  password = "Demo1234!"
 *   owner@demo.test    (owner,   org-wide)
 *   manager@demo.test  (manager, Downtown store)
 *   cashier@demo.test  (cashier, Downtown store)
 *
 * Run:  cd backend/apps/api && (load .env) && pnpm db:seed:demo
 */
import { randomUUID } from "node:crypto";
import { PrismaClient, MovementReason, MovementSource } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ORG_NAME = "Demo Mart";
const PASSWORD = "Demo1234!";
// Fixed ID so the storefront (and any custom domain) can pin this tenant stably
// across re-seeds via STOREFRONT_ORG_ID. See storefront bootstrap().
const DEMO_ORG_ID = "d3m0d3m0-0000-4000-8000-000000000001";

type ProductSpec = {
  category: string;
  name: string;
  brand: string;
  sku: string;
  barcode: string;
  priceCents: number;
  costCents: number;
  // Optional list price / MRP — when > priceCents the storefront shows a
  // strike-through + discount %. Omit for full-price items.
  mrpCents?: number;
  weight: string; // numeric quantity, e.g. "500"
  unit: string; //   e.g. "ml", "g", "L", "pk"
  manufacturer: string;
  // Absolute image URL. Clients (owner app / customer app / storefront) render
  // it directly, so it MUST be absolute — relative /uploads paths don't render
  // in the owner app. These are real, curated Unsplash product photos.
  image: string;
};

const CATEGORIES = ["Beverages", "Snacks", "Dairy", "Household", "Bakery", "Staples"];

// Real Unsplash product photos (verified 200 image/jpeg), sized for mobile.
const IMG = (id: string) => `https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`;

const PRODUCTS: ProductSpec[] = [
  // ── Beverages ───────────────────────────────────────────────────────────────
  { category: "Beverages", name: "Classic Cola 500ml",       brand: "FizzCo",       sku: "DM-COLA-500",   barcode: "8901000000017", priceCents: 4000,  costCents: 2500,  mrpCents: 5000,   weight: "500", unit: "ml", manufacturer: "FizzCo Beverages Pvt Ltd", image: IMG("photo-1622708862830-a026e3ef60bd") },
  { category: "Beverages", name: "Orange Juice 1L",          brand: "Sunny",        sku: "DM-OJ-1L",      barcode: "8901000000024", priceCents: 12000, costCents: 8000,  mrpCents: 15000,  weight: "1",   unit: "L",  manufacturer: "Sunny Foods India",         image: IMG("photo-1621506289937-a8e4df240d0b") },
  { category: "Beverages", name: "Mineral Water 1L",         brand: "AquaPure",     sku: "DM-WATER-1L",   barcode: "8901000000031", priceCents: 2000,  costCents: 1000,  mrpCents: 2500,   weight: "1",   unit: "L",  manufacturer: "AquaPure Springs",          image: IMG("photo-1602143407151-7111542de6e8") },
  { category: "Beverages", name: "Cold Brew Coffee 300ml",   brand: "BrewLab",      sku: "DM-COLDBREW-300", barcode: "8901000000130", priceCents: 15000, costCents: 9500,  mrpCents: 18000, weight: "300", unit: "ml", manufacturer: "BrewLab Roasters",          image: IMG("photo-1621782967300-337e387d0c39") },
  { category: "Beverages", name: "Green Tea 25 Bags",        brand: "LeafPure",     sku: "DM-GTEA-25",    barcode: "8901000000147", priceCents: 25000, costCents: 16000, mrpCents: 29900,  weight: "25",  unit: "pk", manufacturer: "LeafPure Teas",             image: IMG("photo-1627435601361-ec25f5b1d0e5") },
  { category: "Beverages", name: "Energy Drink 250ml",       brand: "VoltX",        sku: "DM-ENERGY-250", barcode: "8901000000154", priceCents: 11000, costCents: 7000,  mrpCents: 12500,  weight: "250", unit: "ml", manufacturer: "VoltX Beverages",           image: IMG("photo-1622543925917-763c34d1a86e") },
  // ── Snacks ────────────────────────────────────────────────────────────────
  { category: "Snacks",    name: "Salted Potato Chips 100g", brand: "CrispyCo",     sku: "DM-CHIPS-100",  barcode: "8901000000048", priceCents: 3000,  costCents: 1800,  mrpCents: 4000,   weight: "100", unit: "g",  manufacturer: "CrispyCo Snacks",           image: IMG("photo-1613919113640-25732ec5e61f") },
  { category: "Snacks",    name: "Milk Chocolate Bar 50g",   brand: "CocoJoy",      sku: "DM-CHOC-50",    barcode: "8901000000055", priceCents: 5000,  costCents: 3000,  mrpCents: 6000,   weight: "50",  unit: "g",  manufacturer: "CocoJoy Confectionery",     image: IMG("photo-1623660053975-cf75a8be0908") },
  { category: "Snacks",    name: "Salted Peanuts 200g",      brand: "NuttyBits",    sku: "DM-PEANUT-200", barcode: "8901000000062", priceCents: 4500,  costCents: 2800,                    weight: "200", unit: "g",  manufacturer: "NuttyBits Foods",           image: IMG("photo-1549978113-29eb25c8177f") },
  { category: "Snacks",    name: "Choco Chip Cookies 150g",  brand: "BakeHouse",    sku: "DM-COOKIE-150", barcode: "8901000000161", priceCents: 6000,  costCents: 3800,  mrpCents: 7500,   weight: "150", unit: "g",  manufacturer: "BakeHouse Foods",           image: IMG("photo-1558961363-fa8fdf82db35") },
  { category: "Snacks",    name: "Butter Popcorn 90g",       brand: "PopTop",       sku: "DM-POP-90",     barcode: "8901000000178", priceCents: 3500,  costCents: 2000,  mrpCents: 4500,   weight: "90",  unit: "g",  manufacturer: "PopTop Snacks",             image: IMG("photo-1578849278619-e73505e9610f") },
  { category: "Snacks",    name: "Granola Bars 6pk",         brand: "OatWell",      sku: "DM-GRANOLA-6",  barcode: "8901000000185", priceCents: 19900, costCents: 13000, mrpCents: 24000,  weight: "6",   unit: "pk", manufacturer: "OatWell Nutrition",         image: IMG("photo-1633360821154-1935fb5671e6") },
  // ── Dairy ───────────────────────────────────────────────────────────────────
  { category: "Dairy",     name: "Whole Milk 1L",            brand: "FarmFresh",    sku: "DM-MILK-1L",    barcode: "8901000000079", priceCents: 6000,  costCents: 4500,                    weight: "1",   unit: "L",  manufacturer: "FarmFresh Dairy Co-op",     image: IMG("photo-1550583724-b2692b85b150") },
  { category: "Dairy",     name: "Greek Yogurt 400g",        brand: "FarmFresh",    sku: "DM-YOG-400",    barcode: "8901000000086", priceCents: 9000,  costCents: 6000,  mrpCents: 11000,  weight: "400", unit: "g",  manufacturer: "FarmFresh Dairy Co-op",     image: IMG("photo-1571212515416-fef01fc43637") },
  { category: "Dairy",     name: "Butter 500g",              brand: "FarmFresh",    sku: "DM-BUTTER-500", barcode: "8901000000093", priceCents: 25000, costCents: 19000, mrpCents: 28000,  weight: "500", unit: "g",  manufacturer: "FarmFresh Dairy Co-op",     image: IMG("photo-1589985270826-4b7bb135bc9d") },
  { category: "Dairy",     name: "Cheddar Cheese 200g",      brand: "FarmFresh",    sku: "DM-CHEESE-200", barcode: "8901000000192", priceCents: 18000, costCents: 13000, mrpCents: 21000,  weight: "200", unit: "g",  manufacturer: "FarmFresh Dairy Co-op",     image: IMG("photo-1552767059-ce182ead6c1b") },
  { category: "Dairy",     name: "Fresh Paneer 200g",        brand: "FarmFresh",    sku: "DM-PANEER-200", barcode: "8901000000208", priceCents: 8500,  costCents: 6000,  mrpCents: 9900,   weight: "200", unit: "g",  manufacturer: "FarmFresh Dairy Co-op",     image: IMG("photo-1596352670192-5a95e357df7b") },
  { category: "Dairy",     name: "Farm Eggs 12pk",           brand: "FarmFresh",    sku: "DM-EGGS-12",    barcode: "8901000000215", priceCents: 8400,  costCents: 6000,  mrpCents: 9900,   weight: "12",  unit: "pk", manufacturer: "FarmFresh Dairy Co-op",     image: IMG("photo-1506976785307-8732e854ad03") },
  // ── Household ─────────────────────────────────────────────────────────────
  { category: "Household", name: "Dishwash Liquid 500ml",    brand: "SparkleClean", sku: "DM-DISH-500",   barcode: "8901000000109", priceCents: 8000,  costCents: 5000,  mrpCents: 10000,  weight: "500", unit: "ml", manufacturer: "SparkleClean Home Care",    image: IMG("photo-1585421514284-efb74c2b69ba") },
  { category: "Household", name: "Paper Towels 2pk",         brand: "SoftRoll",     sku: "DM-TOWEL-2",    barcode: "8901000000116", priceCents: 11000, costCents: 7000,  mrpCents: 13000,  weight: "2",   unit: "pk", manufacturer: "SoftRoll Paper Mills",      image: IMG("photo-1583496597467-d968d2fa33a8") },
  { category: "Household", name: "Laundry Detergent 1kg",    brand: "SparkleClean", sku: "DM-DET-1KG",    barcode: "8901000000123", priceCents: 30000, costCents: 22000, mrpCents: 38000,  weight: "1",   unit: "kg", manufacturer: "SparkleClean Home Care",    image: IMG("photo-1626806819282-2c1dc01a5e0c") },
  { category: "Household", name: "Hand Wash 250ml",          brand: "SparkleClean", sku: "DM-HANDWASH-250", barcode: "8901000000222", priceCents: 9900, costCents: 6000,  mrpCents: 12000, weight: "250", unit: "ml", manufacturer: "SparkleClean Home Care",    image: IMG("photo-1584305574647-0cc949a2bb9f") },
  { category: "Household", name: "Floor Cleaner 1L",         brand: "SparkleClean", sku: "DM-FLOOR-1L",   barcode: "8901000000239", priceCents: 18500, costCents: 12000, mrpCents: 22000,  weight: "1",   unit: "L",  manufacturer: "SparkleClean Home Care",    image: IMG("photo-1563453392212-326f5e854473") },
  // ── Bakery ────────────────────────────────────────────────────────────────
  { category: "Bakery",    name: "Whole Wheat Bread 400g",   brand: "BakeHouse",    sku: "DM-BREAD-400",  barcode: "8901000000246", priceCents: 4500,  costCents: 2800,  mrpCents: 5500,   weight: "400", unit: "g",  manufacturer: "BakeHouse Foods",           image: IMG("photo-1549931319-a545dcf3bc73") },
  // ── Staples ───────────────────────────────────────────────────────────────
  { category: "Staples",   name: "Basmati Rice 5kg",         brand: "GoldenGrain",  sku: "DM-RICE-5KG",   barcode: "8901000000253", priceCents: 65000, costCents: 52000, mrpCents: 79900,  weight: "5",   unit: "kg", manufacturer: "GoldenGrain Agro",          image: IMG("photo-1568347355280-d33fdf77d42a") },
  { category: "Staples",   name: "Extra Virgin Olive Oil 1L", brand: "OliveGrove",  sku: "DM-OLIVE-1L",   barcode: "8901000000260", priceCents: 89900, costCents: 68000, mrpCents: 109900, weight: "1",   unit: "L",  manufacturer: "OliveGrove Imports",        image: IMG("photo-1474979266404-7eaacbcd87c5") },
];

/// Plausible per-category nutrition facts (per serving) for the product detail
/// screen. Household items have none.
function nutritionFor(category: string): Record<string, string> | null {
  switch (category) {
    case "Beverages":
      return { energy: "180 kcal", sugar: "18 g", carbs: "22 g", sodium: "20 mg" };
    case "Snacks":
      return { energy: "250 kcal", fat: "14 g", carbs: "28 g", protein: "4 g" };
    case "Dairy":
      return { energy: "120 kcal", fat: "6 g", protein: "8 g", calcium: "240 mg" };
    default:
      return null;
  }
}

async function wipeExistingDemoOrg(): Promise<void> {
  const orgs = await prisma.organization.findMany({
    where: { OR: [{ name: ORG_NAME }, { id: DEMO_ORG_ID }] },
    select: { id: true },
  });
  if (orgs.length === 0) return;
  const orgIds = orgs.map((o) => o.id);
  const stores = await prisma.store.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true } });
  const storeIds = stores.map((s) => s.id);

  // Delete in dependency order — orders/pos_sales RESTRICT store deletion, so clear them first.
  await prisma.payment.deleteMany({ where: { organizationId: { in: orgIds } } });
  if (storeIds.length) {
    await prisma.posSale.deleteMany({ where: { storeId: { in: storeIds } } }); // cascades pos_sale_items
    await prisma.order.deleteMany({ where: { storeId: { in: storeIds } } });   // cascades order_items
    await prisma.inventoryMovement.deleteMany({ where: { storeId: { in: storeIds } } });
    await prisma.inventory.deleteMany({ where: { storeId: { in: storeIds } } });
    await prisma.syncBatch.deleteMany({ where: { storeId: { in: storeIds } } });
  }
  await prisma.product.deleteMany({ where: { organizationId: { in: orgIds } } }); // cascades variants
  await prisma.category.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.customer.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.user.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.store.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
}

async function main(): Promise<void> {
  await wipeExistingDemoOrg();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ── Org + users ──────────────────────────────────────────────────────────
  const org = await prisma.organization.create({ data: { id: DEMO_ORG_ID, name: ORG_NAME } });

  const downtown = await prisma.store.create({
    data: { organizationId: org.id, name: "Demo Mart — Downtown", address: "12 MG Road, Bengaluru", currency: "INR" },
  });
  const airport = await prisma.store.create({
    data: { organizationId: org.id, name: "Demo Mart — Airport", address: "T2 Retail Plaza, Bengaluru", currency: "INR" },
  });
  const stores = [downtown, airport];

  await prisma.user.create({
    data: { organizationId: org.id, email: "owner@demo.test", passwordHash, name: "Demo Owner", role: "owner" },
  });
  await prisma.user.create({
    data: { organizationId: org.id, storeId: downtown.id, email: "manager@demo.test", passwordHash, name: "Demo Manager", role: "manager" },
  });
  const cashier = await prisma.user.create({
    data: { organizationId: org.id, storeId: downtown.id, email: "cashier@demo.test", passwordHash, name: "Demo Cashier", role: "cashier" },
  });

  // ── Coupons ────────────────────────────────────────────────────────────────
  await prisma.coupon.createMany({
    data: [
      { organizationId: org.id, code: "SAVE10", type: "percent", value: 10, minSubtotalCents: 20000 },
      { organizationId: org.id, code: "FLAT50", type: "flat", value: 5000, minSubtotalCents: 30000 },
      { organizationId: org.id, code: "FRESH15", type: "percent", value: 15, minSubtotalCents: 50000 },
    ],
  });

  // ── Catalog ──────────────────────────────────────────────────────────────
  const categoryByName: Record<string, string> = {};
  for (const name of CATEGORIES) {
    const c = await prisma.category.create({ data: { organizationId: org.id, name } });
    categoryByName[name] = c.id;
  }

  // variantId per SKU, for later sales
  const variantBySku: Record<string, { id: string; priceCents: number }> = {};
  const productIdBySku: Record<string, string> = {};
  for (const p of PRODUCTS) {
    const nutrition = nutritionFor(p.category);
    const product = await prisma.product.create({
      data: {
        organizationId: org.id,
        categoryId: categoryByName[p.category],
        name: p.name,
        brand: p.brand,
        description:
          `${p.brand} ${p.name} — everyday quality from ${p.manufacturer}. ` +
          `Carefully sourced and quality-checked before it reaches your basket.`,
        // Absolute Unsplash URL — rendered directly by all clients.
        images: [p.image],
        attributes: {
          manufacturer: p.manufacturer,
          countryOfOrigin: "India",
          ...(nutrition ? { nutrition } : {}),
        },
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: p.sku,
        barcode: p.barcode,
        priceCents: p.priceCents,
        mrpCents: p.mrpCents ?? null,
        costCents: p.costCents,
        attributes: { weight: p.weight, unit: p.unit },
      },
    });
    variantBySku[p.sku] = { id: variant.id, priceCents: p.priceCents };
    productIdBySku[p.sku] = product.id;
  }

  // ── Reviews: a few review authors leave ratings across the catalog ─────────
  const reviewAuthors = await Promise.all(
    [
      { name: "Priya K.", phone: "+919000000101" },
      { name: "Arjun M.", phone: "+919000000102" },
      { name: "Neha S.", phone: "+919000000103" },
      { name: "Rahul V.", phone: "+919000000104" },
    ].map((a) =>
      prisma.customer.create({ data: { organizationId: org.id, name: a.name, phone: a.phone } }),
    ),
  );
  const reviewSnippets = [
    { rating: 5, title: "Excellent", body: "Fresh and exactly as described. Will reorder." },
    { rating: 4, title: "Good value", body: "Solid quality for the price. Packaging was neat." },
    { rating: 5, title: "Highly recommend", body: "Delivered fast and in great condition." },
    { rating: 3, title: "Decent", body: "Okay overall, nothing special but does the job." },
    { rating: 4, title: "Happy with it", body: "Would buy again." },
  ];
  let rIdx = 0;
  for (const p of PRODUCTS) {
    // 2–4 reviews per product, cycling authors + snippets deterministically.
    const n = 2 + (p.sku.length % 3);
    for (let i = 0; i < n; i++) {
      const author = reviewAuthors[(rIdx + i) % reviewAuthors.length];
      const snip = reviewSnippets[(rIdx + i) % reviewSnippets.length];
      await prisma.productReview.create({
        data: {
          organizationId: org.id,
          productId: productIdBySku[p.sku],
          customerId: author.id,
          rating: snip.rating,
          title: snip.title,
          body: snip.body,
        },
      });
    }
    rIdx++;
  }

  // ── Inventory: opening stock via ledger, then net into cached Inventory ────
  // net onHand per (storeId, variantId)
  const onHand = new Map<string, number>();
  const key = (storeId: string, variantId: string) => `${storeId}:${variantId}`;

  async function movement(storeId: string, variantId: string, delta: number, reason: MovementReason, source: MovementSource, refId?: string): Promise<void> {
    await prisma.inventoryMovement.create({
      data: { id: randomUUID(), storeId, variantId, delta, reason, source, refId: refId ?? null },
    });
    onHand.set(key(storeId, variantId), (onHand.get(key(storeId, variantId)) ?? 0) + delta);
  }

  // Opening stock: 80 units of everything per store, except one item low at Downtown.
  for (const store of stores) {
    for (const p of PRODUCTS) {
      const v = variantBySku[p.sku];
      const opening = store.id === downtown.id && p.sku === "DM-BUTTER-500" ? 3 : 80;
      await movement(store.id, v.id, opening, "restock", "system");
    }
  }

  // ── Online orders (Downtown) — decrement stock, mark paid ─────────────────
  const customer = await prisma.customer.create({
    data: { organizationId: org.id, name: "Demo Shopper", email: "shopper@demo.test", phone: "+919000000001" },
  });

  async function createOrder(items: { sku: string; qty: number }[]): Promise<void> {
    let subtotal = 0;
    const itemData = items.map((it) => {
      const v = variantBySku[it.sku];
      const total = v.priceCents * it.qty;
      subtotal += total;
      return { variantId: v.id, quantity: it.qty, unitPriceCents: v.priceCents, totalCents: total };
    });
    const tax = Math.round(subtotal * 0.05);
    const order = await prisma.order.create({
      data: {
        organizationId: org.id,
        storeId: downtown.id,
        customerId: customer.id,
        status: "completed",
        fulfillmentType: "delivery",
        subtotalCents: subtotal,
        taxCents: tax,
        totalCents: subtotal + tax,
        items: { create: itemData },
      },
    });
    for (const it of items) {
      await movement(downtown.id, variantBySku[it.sku].id, -it.qty, "sale_online", "web", order.id);
    }
    await prisma.payment.create({
      data: {
        organizationId: org.id, target: "order", orderId: order.id,
        gateway: "razorpay", gatewayRef: `pay_${order.id.slice(0, 12)}`,
        method: "online", status: "paid", amountCents: subtotal + tax,
      },
    });
  }

  await createOrder([{ sku: "DM-COLA-500", qty: 2 }, { sku: "DM-CHIPS-100", qty: 1 }]);
  await createOrder([{ sku: "DM-MILK-1L", qty: 3 }, { sku: "DM-YOG-400", qty: 2 }]);

  // ── POS sales (Downtown, offline-then-synced) — decrement stock, cash paid ─
  async function createPosSale(items: { sku: string; qty: number }[]): Promise<void> {
    let subtotal = 0;
    const itemData = items.map((it) => {
      const v = variantBySku[it.sku];
      const total = v.priceCents * it.qty;
      subtotal += total;
      return { variantId: v.id, quantity: it.qty, unitPriceCents: v.priceCents, totalCents: total };
    });
    const tax = Math.round(subtotal * 0.05);
    const sale = await prisma.posSale.create({
      data: {
        storeId: downtown.id,
        cashierId: cashier.id,
        clientUuid: randomUUID(),
        subtotalCents: subtotal,
        taxCents: tax,
        totalCents: subtotal + tax,
        offlineCreatedAt: new Date(),
        syncedAt: new Date(),
        items: { create: itemData },
      },
    });
    for (const it of items) {
      await movement(downtown.id, variantBySku[it.sku].id, -it.qty, "sale_pos", "pos", sale.id);
    }
    await prisma.payment.create({
      data: {
        organizationId: org.id, target: "pos_sale", posSaleId: sale.id,
        gateway: "cash", method: "cash", status: "paid", amountCents: subtotal + tax,
      },
    });
  }

  await createPosSale([{ sku: "DM-CHOC-50", qty: 4 }, { sku: "DM-WATER-1L", qty: 6 }]);
  await createPosSale([{ sku: "DM-PEANUT-200", qty: 1 }, { sku: "DM-COLA-500", qty: 3 }]);

  // ── Materialize cached Inventory from the net ledger ──────────────────────
  for (const store of stores) {
    for (const p of PRODUCTS) {
      const v = variantBySku[p.sku];
      const qty = onHand.get(key(store.id, v.id)) ?? 0;
      await prisma.inventory.create({ data: { storeId: store.id, variantId: v.id, onHand: qty } });
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("✅ Demo Mart seeded:");
  console.log(`   org=${org.id}`);
  console.log(`   stores: ${stores.map((s) => s.name).join(", ")}`);
  console.log(`   users: owner@demo.test / manager@demo.test / cashier@demo.test  (password: ${PASSWORD})`);
  console.log(`   products=${PRODUCTS.length}, sample barcode=${PRODUCTS[0].barcode} (${PRODUCTS[0].name})`);
  console.log("   + 2 online orders, 2 POS sales, payments, and inventory ledger.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
