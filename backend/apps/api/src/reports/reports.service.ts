import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Combined sales summary across POS sales and online orders for the last
   * `days` days, optionally scoped to a store. Totals + a per-day breakdown.
   */
  async salesSummary(organizationId: string, days: number, storeId?: string) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [posSales, orders] = await Promise.all([
      this.prisma.posSale.findMany({
        where: {
          store: { organizationId },
          ...(storeId ? { storeId } : {}),
          createdAt: { gte: since },
        },
        select: { totalCents: true, createdAt: true },
      }),
      this.prisma.order.findMany({
        where: {
          organizationId,
          ...(storeId ? { storeId } : {}),
          createdAt: { gte: since },
        },
        select: { totalCents: true, createdAt: true },
      }),
    ]);

    const byDay = new Map<string, { date: string; totalCents: number; count: number }>();
    const add = (createdAt: Date, totalCents: number) => {
      const date = createdAt.toISOString().slice(0, 10);
      const row = byDay.get(date) ?? { date, totalCents: 0, count: 0 };
      row.totalCents += totalCents;
      row.count += 1;
      byDay.set(date, row);
    };
    posSales.forEach((s) => add(s.createdAt, s.totalCents));
    orders.forEach((o) => add(o.createdAt, o.totalCents));

    const posTotal = posSales.reduce((s, r) => s + r.totalCents, 0);
    const orderTotal = orders.reduce((s, r) => s + r.totalCents, 0);

    return {
      rangeDays: days,
      totalSalesCents: posTotal + orderTotal,
      posSaleCount: posSales.length,
      posSalesCents: posTotal,
      orderCount: orders.length,
      ordersCents: orderTotal,
      byDay: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /**
   * Rich analytics for the owner dashboard: today's KPIs, windowed revenue/
   * profit/AOV, order-status counts, top products & categories, catalog/customer
   * counts, stock alerts, a daily time-series, and recent orders.
   */
  async dashboard(organizationId: string, days: number, storeId?: string, lowStockThreshold = 10) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const orderWhere = {
      organizationId,
      ...(storeId ? { storeId } : {}),
      createdAt: { gte: since },
    };

    const [orders, posSales, customersCount, productsCount, inventory, variants, categories] =
      await Promise.all([
        this.prisma.order.findMany({ where: orderWhere, include: { items: true } }),
        this.prisma.posSale.findMany({
          where: { store: { organizationId }, ...(storeId ? { storeId } : {}), createdAt: { gte: since } },
          include: { items: true },
        }),
        this.prisma.customer.count({ where: { organizationId } }),
        this.prisma.product.count({ where: { organizationId } }),
        this.prisma.inventory.findMany({
          where: { store: { organizationId }, ...(storeId ? { storeId } : {}) },
          select: { onHand: true },
        }),
        this.prisma.productVariant.findMany({
          where: { product: { organizationId } },
          select: { id: true, costCents: true, productId: true },
        }),
        this.prisma.category.findMany({
          where: { organizationId },
          select: { id: true, name: true },
        }),
      ]);

    const products = await this.prisma.product.findMany({
      where: { organizationId },
      select: { id: true, name: true, categoryId: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const variantById = new Map(variants.map((v) => [v.id, v]));

    // ── Revenue / orders / today ──────────────────────────────────────────────
    const orderRevenue = orders.reduce((s, o) => s + o.totalCents, 0);
    const posRevenue = posSales.reduce((s, o) => s + o.totalCents, 0);
    const revenueCents = orderRevenue + posRevenue;
    const txnCount = orders.length + posSales.length;

    const todayOrders = orders.filter((o) => o.createdAt >= startOfToday);
    const todayPos = posSales.filter((o) => o.createdAt >= startOfToday);
    const todaySalesCents =
      todayOrders.reduce((s, o) => s + o.totalCents, 0) +
      todayPos.reduce((s, o) => s + o.totalCents, 0);

    // ── Profit (revenue − COGS from variant cost) ───────────────────────────────
    let cogsCents = 0;
    const allItems = [
      ...orders.flatMap((o) => o.items),
      ...posSales.flatMap((s) => s.items),
    ];
    for (const it of allItems) {
      const cost = variantById.get(it.variantId)?.costCents ?? 0;
      cogsCents += cost * it.quantity;
    }
    const profitCents = revenueCents - cogsCents;

    // ── Order status counts ─────────────────────────────────────────────────────
    const statusCounts: Record<string, number> = {};
    for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;

    // ── Top products / categories (by qty sold) ─────────────────────────────────
    const prodAgg = new Map<string, { name: string; qty: number; revenueCents: number }>();
    const catAgg = new Map<string, { name: string; qty: number; revenueCents: number }>();
    for (const it of allItems) {
      const variant = variantById.get(it.variantId);
      const product = variant ? productById.get(variant.productId) : undefined;
      if (!product) continue;
      const p = prodAgg.get(product.id) ?? { name: product.name, qty: 0, revenueCents: 0 };
      p.qty += it.quantity;
      p.revenueCents += it.totalCents;
      prodAgg.set(product.id, p);
      if (product.categoryId) {
        const cname = categoryById.get(product.categoryId) ?? "Uncategorized";
        const c = catAgg.get(product.categoryId) ?? { name: cname, qty: 0, revenueCents: 0 };
        c.qty += it.quantity;
        c.revenueCents += it.totalCents;
        catAgg.set(product.categoryId, c);
      }
    }
    const topProducts = [...prodAgg.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
    const topCategories = [...catAgg.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

    // ── Daily time-series ────────────────────────────────────────────────────────
    const byDay = new Map<string, { date: string; totalCents: number; count: number }>();
    const add = (createdAt: Date, totalCents: number) => {
      const date = createdAt.toISOString().slice(0, 10);
      const row = byDay.get(date) ?? { date, totalCents: 0, count: 0 };
      row.totalCents += totalCents;
      row.count += 1;
      byDay.set(date, row);
    };
    orders.forEach((o) => add(o.createdAt, o.totalCents));
    posSales.forEach((s) => add(s.createdAt, s.totalCents));

    // ── Recent orders ─────────────────────────────────────────────────────────────
    const recentOrders = [...orders]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        status: o.status,
        totalCents: o.totalCents,
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
        createdAt: o.createdAt,
      }));

    return {
      rangeDays: days,
      todaySalesCents,
      todayOrders: todayOrders.length + todayPos.length,
      pendingOrders: statusCounts["pending"] ?? 0,
      cancelledOrders: statusCounts["cancelled"] ?? 0,
      revenueCents,
      profitCents,
      avgOrderValueCents: txnCount > 0 ? Math.round(revenueCents / txnCount) : 0,
      orderCount: orders.length,
      posSaleCount: posSales.length,
      customersCount,
      productsCount,
      lowStockCount: inventory.filter((i) => i.onHand > 0 && i.onHand <= lowStockThreshold).length,
      outOfStockCount: inventory.filter((i) => i.onHand <= 0).length,
      statusCounts,
      topProducts,
      topCategories,
      recentOrders,
      byDay: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /** Variants at or below a stock threshold, for owner low-stock alerts. */
  async lowStock(organizationId: string, threshold: number, storeId?: string) {
    const rows = await this.prisma.inventory.findMany({
      where: {
        store: { organizationId },
        ...(storeId ? { storeId } : {}),
        onHand: { lte: threshold },
      },
      include: {
        store: { select: { id: true, name: true } },
        variant: { include: { product: { select: { id: true, name: true } } } },
      },
      orderBy: { onHand: "asc" },
    });
    return rows.map((r) => ({
      storeId: r.storeId,
      storeName: r.store.name,
      variantId: r.variantId,
      sku: r.variant.sku,
      barcode: r.variant.barcode,
      productName: r.variant.product.name,
      onHand: r.onHand,
    }));
  }
}
