import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Org-scoped data export — a portable JSON snapshot of the tenant's catalog and
 * configuration for backup / migration. Read-only; excludes secrets (api key
 * hashes, password hashes) and high-volume transactional ledgers.
 */
@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService) {}

  async export(organizationId: string) {
    const where = { organizationId };
    const [organization, stores, categories, brands, suppliers, products, coupons, banners, layouts] =
      await Promise.all([
        this.prisma.organization.findUnique({ where: { id: organizationId } }),
        this.prisma.store.findMany({ where }),
        this.prisma.category.findMany({ where }),
        this.prisma.brand.findMany({ where }),
        this.prisma.supplier.findMany({ where }),
        this.prisma.product.findMany({ where, include: { variants: true } }),
        this.prisma.coupon.findMany({ where }),
        this.prisma.banner.findMany({ where }),
        this.prisma.homeLayout.findMany({ where, include: { sections: true } }),
      ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      organization,
      counts: {
        stores: stores.length,
        categories: categories.length,
        brands: brands.length,
        suppliers: suppliers.length,
        products: products.length,
        coupons: coupons.length,
        banners: banners.length,
        layouts: layouts.length,
      },
      data: { stores, categories, brands, suppliers, products, coupons, banners, layouts },
    };
  }
}
