import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
        addresses: true,
      },
    });
    if (!c) throw new NotFoundException("Customer not found");
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      createdAt: c.createdAt,
      addresses: c.addresses,
      orders: c.orders.map((o) => ({
        id: o.id,
        status: o.status,
        totalCents: o.totalCents,
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
        createdAt: o.createdAt,
      })),
    };
  }
}
