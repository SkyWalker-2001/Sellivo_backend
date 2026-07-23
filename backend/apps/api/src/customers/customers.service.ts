import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateCustomerDto } from "./dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Owner customer directory with order count + lifetime spend. */
  async list(organizationId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        orders: { select: { totalCents: true, status: true } },
        _count: { select: { orders: true, reviews: true, addresses: true } },
      },
    });
    return customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      blocked: c.blocked,
      createdAt: c.createdAt,
      orderCount: c._count.orders,
      reviewCount: c._count.reviews,
      addressCount: c._count.addresses,
      lifetimeSpendCents: c.orders
        .filter((o) => o.status !== "cancelled")
        .reduce((s, o) => s + o.totalCents, 0),
    }));
  }

  async get(organizationId: string, id: string) {
    const c = await this.prisma.customer.findFirst({
      where: { id, organizationId },
      include: {
        orders: { orderBy: { createdAt: "desc" }, include: { items: true } },
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
        reviews: {
          orderBy: { createdAt: "desc" },
          include: { product: { select: { name: true } } },
        },
      },
    });
    if (!c) throw new NotFoundException("Customer not found");

    // Coupon redemptions with the code that was used.
    const redemptions = await this.prisma.couponRedemption.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      include: { coupon: { select: { code: true, type: true } } },
    });

    const live = c.orders.filter((o) => o.status !== "cancelled");
    const lifetimeSpendCents = live.reduce((s, o) => s + o.totalCents, 0);

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      blocked: c.blocked,
      ownerNote: c.ownerNote,
      createdAt: c.createdAt,
      // Spend & order stats.
      stats: {
        orderCount: c.orders.length,
        lifetimeSpendCents,
        avgOrderCents: live.length ? Math.round(lifetimeSpendCents / live.length) : 0,
        lastOrderAt: c.orders[0]?.createdAt ?? null,
      },
      addresses: c.addresses,
      orders: c.orders.map((o) => ({
        id: o.id,
        status: o.status,
        totalCents: o.totalCents,
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
        createdAt: o.createdAt,
      })),
      coupons: redemptions.map((r) => ({
        code: r.coupon.code,
        type: r.coupon.type,
        orderId: r.orderId,
        createdAt: r.createdAt,
      })),
      reviews: c.reviews.map((rv) => ({
        id: rv.id,
        product: rv.product.name,
        rating: rv.rating,
        title: rv.title,
        body: rv.body,
        createdAt: rv.createdAt,
      })),
    };
  }

  /** Edit a customer's contact details and/or private owner note. */
  async update(organizationId: string, id: string, dto: UpdateCustomerDto) {
    await this.assert(organizationId, id);
    const phone = dto.phone?.trim() || null;
    if (phone) {
      const clash = await this.prisma.customer.findFirst({
        where: { organizationId, phone, id: { not: id } },
      });
      if (clash) throw new NotFoundException("That mobile number is already in use");
    }
    await this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name?.trim() || null,
        phone,
        ownerNote: dto.ownerNote?.trim() || null,
      },
    });
    return this.get(organizationId, id);
  }

  /** Block or unblock a customer (blocked = can't sign in or order). */
  async setBlocked(organizationId: string, id: string, blocked: boolean) {
    await this.assert(organizationId, id);
    await this.prisma.customer.update({ where: { id }, data: { blocked } });
    return this.get(organizationId, id);
  }

  /** Remove a customer. Orders are kept (Order.customerId is set null). */
  async remove(organizationId: string, id: string) {
    await this.assert(organizationId, id);
    await this.prisma.customer.delete({ where: { id } });
    return { deleted: true };
  }

  private async assert(organizationId: string, id: string) {
    const c = await this.prisma.customer.findFirst({ where: { id, organizationId } });
    if (!c) throw new NotFoundException("Customer not found");
  }
}
