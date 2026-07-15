import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { UpsertBrandDto } from "./dto";

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.brand.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
  }

  create(organizationId: string, dto: UpsertBrandDto) {
    return this.prisma.brand.create({
      data: { organizationId, name: dto.name, logoUrl: dto.logoUrl ?? null },
    });
  }

  async update(organizationId: string, id: string, dto: UpsertBrandDto) {
    await this.assert(organizationId, id);
    return this.prisma.brand.update({
      where: { id },
      data: { name: dto.name, logoUrl: dto.logoUrl ?? null },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.assert(organizationId, id);
    await this.prisma.brand.delete({ where: { id } });
    return { deleted: true };
  }

  private async assert(organizationId: string, id: string) {
    const b = await this.prisma.brand.findFirst({ where: { id, organizationId } });
    if (!b) throw new NotFoundException("Brand not found");
  }
}
