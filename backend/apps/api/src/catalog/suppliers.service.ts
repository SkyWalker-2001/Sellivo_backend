import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { UpsertSupplierDto } from "./dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.supplier.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
  }

  create(organizationId: string, dto: UpsertSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        organizationId,
        name: dto.name,
        contactName: dto.contactName ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpsertSupplierDto) {
    await this.assert(organizationId, id);
    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        contactName: dto.contactName ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
      },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.assert(organizationId, id);
    await this.prisma.supplier.delete({ where: { id } });
    return { deleted: true };
  }

  private async assert(organizationId: string, id: string) {
    const s = await this.prisma.supplier.findFirst({ where: { id, organizationId } });
    if (!s) throw new NotFoundException("Supplier not found");
  }
}
