import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import type {
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  UpdateCategoryDto,
  UpdatePricesDto,
  UpdateProductDto,
  UpdateVariantDto,
} from "./dto";

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  // ── Categories ─────────────────────────────────────────────────────────────
  createCategory(organizationId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { organizationId, ...dto } });
  }

  /** List categories with product counts, ordered for the category-first UI. */
  async listCategories(organizationId: string) {
    const rows = await this.prisma.category.findMany({
      where: { organizationId },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    return rows.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
  }

  async updateCategory(organizationId: string, id: string, dto: UpdateCategoryDto) {
    await this.assertCategory(organizationId, id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  /** Delete a category. Its products are orphaned (categoryId → null) via the schema. */
  async deleteCategory(organizationId: string, id: string) {
    await this.assertCategory(organizationId, id);
    await this.prisma.category.delete({ where: { id } });
    return { deleted: true };
  }

  /** Persist a new category ordering; index in the list becomes displayOrder. */
  async reorderCategories(organizationId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, i) =>
        this.prisma.category.updateMany({
          where: { id, organizationId },
          data: { displayOrder: i },
        }),
      ),
    );
    return this.listCategories(organizationId);
  }

  // ── Products ────────────────────────────────────────────────────────────────
  createProduct(organizationId: string, dto: CreateProductDto) {
    const { images, attributes, ...rest } = dto;
    return this.prisma.product.create({
      data: {
        organizationId,
        ...rest,
        images: (images ?? []) as Prisma.InputJsonValue,
        attributes: (attributes ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * List products with variants. Supports the category-first UI: filter by
   * category (`categoryId`, or `"none"` for uncategorized), free-text search,
   * and skip/take pagination. Each variant is annotated with `stock` (on-hand
   * summed across the org's stores) so cards can show stock without a second call.
   */
  async listProducts(
    organizationId: string,
    opts: { categoryId?: string; q?: string; skip?: number; take?: number; storeId?: string } = {},
  ) {
    const { categoryId, q } = opts;
    const skip = opts.skip && opts.skip > 0 ? opts.skip : undefined;
    const take = opts.take && opts.take > 0 ? Math.min(opts.take, 200) : undefined;

    const where: Prisma.ProductWhereInput = { organizationId };
    if (categoryId === "none") where.categoryId = null;
    else if (categoryId) where.categoryId = categoryId;
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { brand: { contains: term, mode: "insensitive" } },
        { variants: { some: { sku: { contains: term, mode: "insensitive" } } } },
        { variants: { some: { barcode: { contains: term, mode: "insensitive" } } } },
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      include: { variants: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });

    // Aggregate on-hand stock per variant. Scoped to `storeId` when given,
    // otherwise summed across all of the org's stores.
    const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));
    const stockByVariant = new Map<string, number>();
    if (variantIds.length) {
      const grouped = await this.prisma.inventory.groupBy({
        by: ["variantId"],
        where: {
          variantId: { in: variantIds },
          ...(opts.storeId ? { storeId: opts.storeId } : {}),
        },
        _sum: { onHand: true },
      });
      for (const g of grouped) stockByVariant.set(g.variantId, g._sum.onHand ?? 0);
    }
    return products.map((p) => ({
      ...p,
      variants: p.variants.map((v) => ({ ...v, stock: stockByVariant.get(v.id) ?? 0 })),
    }));
  }

  async getProduct(organizationId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
      include: { variants: true },
    });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  async updateProduct(organizationId: string, id: string, dto: UpdateProductDto) {
    await this.getProduct(organizationId, id);
    const { images, attributes, ...rest } = dto;
    return this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(images !== undefined ? { images: images as Prisma.InputJsonValue } : {}),
        ...(attributes !== undefined ? { attributes: attributes as Prisma.InputJsonValue } : {}),
      },
    });
  }

  // ── Variants ─────────────────────────────────────────────────────────────────
  async createVariant(organizationId: string, productId: string, dto: CreateVariantDto) {
    await this.getProduct(organizationId, productId);
    const { attributes, expiryDate, ...rest } = dto;
    return this.prisma.productVariant.create({
      data: {
        productId,
        ...rest,
        ...(expiryDate ? { expiryDate: new Date(expiryDate) } : {}),
        attributes: (attributes ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async updateVariant(organizationId: string, id: string, dto: UpdateVariantDto) {
    await this.assertVariant(organizationId, id);
    const { attributes, expiryDate, ...rest } = dto;
    return this.prisma.productVariant.update({
      where: { id },
      data: {
        ...rest,
        // `null` clears the date; `undefined` leaves it untouched.
        ...(expiryDate !== undefined
          ? { expiryDate: expiryDate ? new Date(expiryDate) : null }
          : {}),
        ...(attributes !== undefined ? { attributes: attributes as Prisma.InputJsonValue } : {}),
      },
    });
  }

  // ── Price management ─────────────────────────────────────────────────────────
  /**
   * Update any subset of a variant's price tiers, log each change to the
   * immutable PriceHistory, and broadcast `price:updated` so POS / customer /
   * storefront clients can refresh. Prices are org-wide (base) for now; `scope`
   * is recorded for audit and future per-branch overrides.
   */
  async updatePrices(organizationId: string, variantId: string, dto: UpdatePricesDto) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, product: { organizationId } },
    });
    if (!variant) throw new NotFoundException("Variant not found");

    // Map each incoming tier to its column + current value.
    const tiers: { field: string; column: keyof typeof variant; next?: number }[] = [
      { field: "selling", column: "priceCents", next: dto.sellingCents },
      { field: "mrp", column: "mrpCents", next: dto.mrpCents },
      { field: "cost", column: "costCents", next: dto.costCents },
      { field: "wholesale", column: "wholesaleCents", next: dto.wholesaleCents },
      { field: "member", column: "memberCents", next: dto.memberCents },
      { field: "delivery", column: "deliveryCents", next: dto.deliveryCents },
      { field: "offer", column: "offerCents", next: dto.offerCents },
    ];
    const scope = dto.scope?.trim() || "all";
    const data: Record<string, number> = {};
    const historyRows: Prisma.PriceHistoryCreateManyInput[] = [];
    for (const t of tiers) {
      if (t.next === undefined) continue;
      const old = variant[t.column] as number | null;
      if (old === t.next) continue;
      data[t.column as string] = t.next;
      historyRows.push({
        variantId,
        field: t.field,
        oldCents: old ?? null,
        newCents: t.next,
        scope,
        note: dto.note ?? null,
      });
    }
    if (historyRows.length === 0) return variant;

    const [updated] = await this.prisma.$transaction([
      this.prisma.productVariant.update({ where: { id: variantId }, data }),
      this.prisma.priceHistory.createMany({ data: historyRows }),
    ]);

    this.events.emitToOrg(organizationId, "price:updated", {
      variantId,
      productId: variant.productId,
      scope,
      prices: data,
    });
    return updated;
  }

  /** Immutable price-change log for a variant (newest first). */
  async priceHistory(organizationId: string, variantId: string) {
    await this.assertVariant(organizationId, variantId);
    return this.prisma.priceHistory.findMany({
      where: { variantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /** Delete a variant. Refuses if it has sales history (would orphan records). */
  async deleteVariant(organizationId: string, id: string) {
    await this.assertVariant(organizationId, id);
    const [orderItems, posItems] = await Promise.all([
      this.prisma.orderItem.count({ where: { variantId: id } }),
      this.prisma.posSaleItem.count({ where: { variantId: id } }),
    ]);
    if (orderItems + posItems > 0) {
      throw new ConflictException("Cannot delete a variant with sales history");
    }
    // inventory + movements cascade via the schema.
    await this.prisma.productVariant.delete({ where: { id } });
    return { deleted: true };
  }

  /** Delete a product. Refuses if any of its variants has sales history. */
  async deleteProduct(organizationId: string, id: string) {
    await this.getProduct(organizationId, id);
    const variantIds = (
      await this.prisma.productVariant.findMany({ where: { productId: id }, select: { id: true } })
    ).map((v) => v.id);
    if (variantIds.length) {
      const [orderItems, posItems] = await Promise.all([
        this.prisma.orderItem.count({ where: { variantId: { in: variantIds } } }),
        this.prisma.posSaleItem.count({ where: { variantId: { in: variantIds } } }),
      ]);
      if (orderItems + posItems > 0) {
        throw new ConflictException("Cannot delete a product with sales history");
      }
    }
    // variants (and their inventory/movements) cascade via the schema.
    await this.prisma.product.delete({ where: { id } });
    return { deleted: true };
  }

  /** POS lookup: resolve a scanned barcode to a variant within this org. */
  async findByBarcode(organizationId: string, barcode: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { barcode, product: { organizationId } },
      include: { product: true },
    });
    if (!variant) throw new NotFoundException("No variant for barcode");
    return variant;
  }

  // ── Bulk CSV import / export ──────────────────────────────────────────────
  /** Export the catalog as CSV text (one row per variant). */
  async exportProductsCsv(organizationId: string): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: { organizationId },
      include: { category: true, variants: true },
      orderBy: { name: "asc" },
    });
    const header = [
      "name", "brand", "category", "description",
      "sku", "barcode", "priceCents", "mrpCents", "costCents",
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: string[] = [header.join(",")];
    for (const p of products) {
      const variants = p.variants.length ? p.variants : [null];
      for (const v of variants) {
        rows.push([
          p.name, p.brand ?? "", p.category?.name ?? "", p.description ?? "",
          v?.sku ?? "", v?.barcode ?? "", v?.priceCents ?? "", v?.mrpCents ?? "", v?.costCents ?? "",
        ].map(esc).join(","));
      }
    }
    return rows.join("\n");
  }

  /**
   * Bulk upsert products from parsed CSV rows. Matches by SKU: existing variant
   * → update price/product; new SKU → create product (find-or-create category)
   * + variant. Returns counts.
   */
  async importProducts(
    organizationId: string,
    rows: {
      name: string;
      brand?: string;
      category?: string;
      description?: string;
      sku: string;
      barcode?: string;
      priceCents: number;
      mrpCents?: number;
      costCents?: number;
    }[],
  ) {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.sku?.trim() || !row.name?.trim()) {
        errors.push(`Skipped row (missing name/sku): ${JSON.stringify(row)}`);
        continue;
      }
      try {
        // Resolve category (find-or-create by name).
        let categoryId: string | null = null;
        if (row.category?.trim()) {
          const cat =
            (await this.prisma.category.findFirst({
              where: { organizationId, name: row.category.trim() },
            })) ??
            (await this.prisma.category.create({
              data: { organizationId, name: row.category.trim() },
            }));
          categoryId = cat.id;
        }

        const existing = await this.prisma.productVariant.findFirst({
          where: { sku: row.sku.trim(), product: { organizationId } },
          include: { product: true },
        });

        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.productId },
            data: {
              name: row.name.trim(),
              brand: row.brand?.trim() || null,
              description: row.description?.trim() || null,
              ...(categoryId ? { categoryId } : {}),
            },
          });
          await this.prisma.productVariant.update({
            where: { id: existing.id },
            data: {
              barcode: row.barcode?.trim() || null,
              priceCents: Number(row.priceCents) || existing.priceCents,
              mrpCents: row.mrpCents != null ? Number(row.mrpCents) : null,
              costCents: row.costCents != null ? Number(row.costCents) : null,
            },
          });
          updated++;
        } else {
          const product = await this.prisma.product.create({
            data: {
              organizationId,
              categoryId,
              name: row.name.trim(),
              brand: row.brand?.trim() || null,
              description: row.description?.trim() || null,
            },
          });
          await this.prisma.productVariant.create({
            data: {
              productId: product.id,
              sku: row.sku.trim(),
              barcode: row.barcode?.trim() || null,
              priceCents: Number(row.priceCents) || 0,
              mrpCents: row.mrpCents != null ? Number(row.mrpCents) : null,
              costCents: row.costCents != null ? Number(row.costCents) : null,
            },
          });
          created++;
        }
      } catch (e) {
        errors.push(`Row "${row.sku}" failed: ${(e as Error).message}`);
      }
    }
    return { created, updated, errorCount: errors.length, errors: errors.slice(0, 10) };
  }

  private async assertCategory(organizationId: string, id: string) {
    const found = await this.prisma.category.findFirst({ where: { id, organizationId } });
    if (!found) throw new NotFoundException("Category not found");
  }

  private async assertVariant(organizationId: string, id: string) {
    const found = await this.prisma.productVariant.findFirst({
      where: { id, product: { organizationId } },
    });
    if (!found) throw new NotFoundException("Variant not found");
  }
}
