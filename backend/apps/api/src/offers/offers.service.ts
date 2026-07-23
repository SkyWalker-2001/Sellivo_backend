import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { UpsertCouponDto } from "./dto";

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.coupon.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(organizationId: string, dto: UpsertCouponDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.coupon.findFirst({
      where: { organizationId, code },
    });
    if (existing) throw new ConflictException("A coupon with that code already exists");
    return this.prisma.coupon.create({
      data: {
        organizationId,
        code,
        type: dto.type,
        value: dto.type === "free_delivery" ? 0 : (dto.value ?? 0),
        minSubtotalCents: dto.minSubtotalCents ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpsertCouponDto) {
    await this.assert(organizationId, id);
    return this.prisma.coupon.update({
      where: { id },
      data: {
        code: dto.code.trim().toUpperCase(),
        type: dto.type,
        value: dto.type === "free_delivery" ? 0 : (dto.value ?? 0),
        minSubtotalCents: dto.minSubtotalCents ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.assert(organizationId, id);
    await this.prisma.coupon.delete({ where: { id } });
    return { deleted: true };
  }

  private async assert(organizationId: string, id: string) {
    const c = await this.prisma.coupon.findFirst({ where: { id, organizationId } });
    if (!c) throw new NotFoundException("Coupon not found");
  }
}
