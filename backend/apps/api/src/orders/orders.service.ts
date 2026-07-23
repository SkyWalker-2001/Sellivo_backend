import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { EventsGateway } from "../events/events.gateway";
import type { CreateOrderDto } from "./dto";

// Storefront pricing rules (kept here so totals are computed server-side).
// GST is included in the selling price, so we back-calculate the embedded tax
// portion (rate / (1 + rate)) for display; it is NOT added on top of the total.
const GST_RATE = 0.05; // 5% GST, already included in the selling price
const DELIVERY_FEE_CENTS = 2500; // ₹25 delivery
const FREE_DELIVERY_THRESHOLD_CENTS = 50000; // free over ₹500

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly events: EventsGateway,
  ) {}

  /**
   * Resolve a coupon to a discount for the given subtotal. Returns 0 when the
   * code is unknown/inactive or the minimum spend isn't met.
   */
  async computeDiscountCents(
    organizationId: string,
    code: string | undefined,
    subtotalCents: number,
  ): Promise<number> {
    return (await this.resolveCoupon(organizationId, code, subtotalCents)).discountCents;
  }

  /**
   * Resolve a coupon to its full effect: a subtotal discount and/or a waived
   * delivery fee. Returns zeros when the code is unknown/inactive or the minimum
   * spend isn't met.
   */
  async resolveCoupon(
    organizationId: string,
    code: string | undefined,
    subtotalCents: number,
  ): Promise<{ discountCents: number; freeDelivery: boolean }> {
    const none = { discountCents: 0, freeDelivery: false };
    if (!code) return none;
    const coupon = await this.prisma.coupon.findFirst({
      where: { organizationId, code: code.trim().toUpperCase(), active: true },
    });
    if (!coupon || subtotalCents < coupon.minSubtotalCents) return none;
    if (coupon.type === "free_delivery") {
      return { discountCents: 0, freeDelivery: true };
    }
    const raw =
      coupon.type === "percent"
        ? Math.round((subtotalCents * coupon.value) / 100)
        : coupon.value;
    return { discountCents: Math.min(raw, subtotalCents), freeDelivery: false };
  }

  /**
   * Create an online order. Unlike the POS, online checkout is allowed to refuse
   * (PLAN.md §4): we validate live stock against the cached total and reject if
   * insufficient, then decrement via sale_online ledger movements.
   */
  async create(organizationId: string, dto: CreateOrderDto) {
    const store = await this.prisma.store.findFirst({
      where: { id: dto.storeId, organizationId },
    });
    if (!store) throw new NotFoundException("Store not found");

    // Resolve prices from variants (server is authoritative on price).
    const variantIds = dto.items.map((i) => i.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, product: { organizationId } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));
    if (variants.length !== new Set(variantIds).size) {
      throw new BadRequestException("One or more variants not found");
    }

    const lines = dto.items.map((i) => {
      const variant = byId.get(i.variantId)!;
      const unitPriceCents = variant.priceCents;
      return {
        variantId: i.variantId,
        quantity: i.quantity,
        unitPriceCents,
        totalCents: unitPriceCents * i.quantity,
      };
    });
    const subtotalCents = lines.reduce((s, l) => s + l.totalCents, 0);

    // Bill breakdown (server-authoritative): discount → GST → delivery.
    const { discountCents, freeDelivery } = await this.resolveCoupon(
      organizationId,
      dto.couponCode,
      subtotalCents,
    );
    const taxedBase = subtotalCents - discountCents;
    // GST-inclusive: tax is the portion already embedded in taxedBase, not an add-on.
    const taxCents = Math.round((taxedBase * GST_RATE) / (1 + GST_RATE));
    const deliveryFeeCents =
      dto.fulfillmentType === "delivery" &&
      !freeDelivery &&
      taxedBase < FREE_DELIVERY_THRESHOLD_CENTS
        ? DELIVERY_FEE_CENTS
        : 0;
    const totalCents = taxedBase + deliveryFeeCents;

    return this.prisma.$transaction(async (tx) => {
      // Live stock check against the cached on-hand total.
      for (const line of lines) {
        const inv = await tx.inventory.findUnique({
          where: { storeId_variantId: { storeId: dto.storeId, variantId: line.variantId } },
        });
        if (!inv || inv.onHand < line.quantity) {
          throw new BadRequestException(`Insufficient stock for variant ${line.variantId}`);
        }
      }

      const order = await tx.order.create({
        data: {
          organizationId,
          storeId: dto.storeId,
          customerId: dto.customerId ?? null,
          fulfillmentType: dto.fulfillmentType,
          status: "pending",
          subtotalCents,
          discountCents,
          taxCents,
          deliveryFeeCents,
          totalCents,
          couponCode:
            discountCents > 0 || freeDelivery ? dto.couponCode?.trim().toUpperCase() : null,
          deliveryAddress: dto.deliveryAddress ?? null,
          deliverySlot: dto.deliverySlot ?? null,
          notes: dto.notes ?? null,
          items: { create: lines },
          statusHistory: { create: { status: "pending" } },
        },
        include: { items: true },
      });

      for (const line of lines) {
        await this.inventory.applyMovement(tx, {
          storeId: dto.storeId,
          variantId: line.variantId,
          delta: -line.quantity,
          reason: "sale_online",
          source: "web",
          refId: order.id,
        });
      }

      return order;
    }).then((order) => {
      // Notify owner dashboards of the new order in realtime.
      this.events.emitToOrg(organizationId, "order:created", {
        id: order.id,
        totalCents: order.totalCents,
      });
      return order;
    });
  }

  /** Full order for the detail screen: line items with product, payments,
   *  customer, and the status timeline (oldest → newest). */
  async get(organizationId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        payments: true,
        customer: true,
        assignedTo: { select: { id: true, name: true } },
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  /** Paginated, searchable order list for the OMS. Search matches order id,
   *  customer name/phone, and delivery address. */
  async list(
    organizationId: string,
    opts: { storeId?: string; q?: string; status?: string; skip?: number; take?: number } = {},
  ) {
    const skip = opts.skip && opts.skip > 0 ? opts.skip : undefined;
    const take = opts.take && opts.take > 0 ? Math.min(opts.take, 100) : undefined;
    const where: Prisma.OrderWhereInput = {
      organizationId,
      ...(opts.storeId ? { storeId: opts.storeId } : {}),
      ...(opts.status && opts.status !== "all" ? { status: opts.status as OrderStatus } : {}),
    };
    const q = opts.q?.trim();
    if (q) {
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { deliveryAddress: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { phone: { contains: q, mode: "insensitive" } } },
      ];
    }
    return this.prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        payments: true,
        customer: true,
        assignedTo: { select: { id: true, name: true } },
      },
      skip,
      take,
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: OrderStatus,
    note?: string,
    role?: string,
  ) {
    const order = await this.get(organizationId, id);
    if (order.status !== status && !this.canTransition(order.status, status)) {
      throw new BadRequestException(`Cannot move an order from ${order.status} to ${status}`);
    }
    // Owner confirmation gate: a customer order sits in `pending` until the
    // owner (or a manager) confirms it. Cashiers/riders cannot confirm.
    if (
      order.status === "pending" &&
      status === "confirmed" &&
      !["owner", "manager"].includes(role ?? "")
    ) {
      throw new ForbiddenException("Only the owner or a manager can confirm an order");
    }
    const data: Prisma.OrderUpdateInput = { status };
    // Generate the 4-digit proof-of-delivery code when dispatch starts.
    if (status === "out_for_delivery" && !order.deliveryOtp) {
      data.deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.order.update({ where: { id }, data });
      await tx.orderStatusHistory.create({
        data: { orderId: id, status, note: note?.trim() || null },
      });
      // Restock when an order is cancelled — its stock was decremented at
      // create, so a rejection/cancellation must return it to inventory.
      if (status === "cancelled" && order.status !== "cancelled") {
        for (const item of order.items) {
          await this.inventory.applyMovement(tx, {
            storeId: order.storeId,
            variantId: item.variantId,
            delta: item.quantity,
            reason: "restock",
            source: "system",
            refId: id,
          });
        }
      }
      return u;
    });
    // Broadcast so owner / customer / delivery clients refresh in realtime.
    this.events.emitToOrg(organizationId, "order:updated", {
      id: updated.id,
      status: updated.status,
    });
    return updated;
  }

  /** Assign an order to a delivery-role staff member. */
  async assign(organizationId: string, id: string, staffId: string) {
    const order = await this.prisma.order.findFirst({ where: { id, organizationId } });
    if (!order) throw new NotFoundException("Order not found");
    const staff = await this.prisma.user.findFirst({
      where: { id: staffId, organizationId, role: "delivery" },
    });
    if (!staff) throw new BadRequestException("Pick a delivery staff member");
    await this.prisma.order.update({ where: { id }, data: { assignedToId: staffId } });
    this.events.emitToOrg(organizationId, "order:updated", { id, status: order.status });
    return this.get(organizationId, id);
  }

  /** A rider's active deliveries. The proof-of-delivery code is never returned
   *  to the rider — the customer reads it out to confirm delivery. */
  async assignedOrders(organizationId: string, userId: string) {
    const rows = await this.prisma.order.findMany({
      where: {
        organizationId,
        assignedToId: userId,
        status: { in: ["confirmed", "preparing", "packed", "ready", "out_for_delivery"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        customer: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    });
    return rows.map(({ deliveryOtp: _otp, ...o }) => o);
  }

  /** Rider marks an order delivered by entering the customer's 4-digit code. */
  async deliver(organizationId: string, id: string, userId: string, code: string) {
    const order = await this.prisma.order.findFirst({ where: { id, organizationId } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.assignedToId !== userId) {
      throw new ForbiddenException("This order isn't assigned to you");
    }
    if (order.status !== "out_for_delivery") {
      throw new BadRequestException("Order is not out for delivery");
    }
    if (!order.deliveryOtp || order.deliveryOtp !== code.trim()) {
      throw new BadRequestException("Incorrect delivery code");
    }
    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id }, data: { status: "delivered" } }),
      this.prisma.orderStatusHistory.create({
        data: { orderId: id, status: "delivered", note: "Delivered — code verified" },
      }),
    ]);
    this.events.emitToOrg(organizationId, "order:updated", { id, status: "delivered" });
    return this.get(organizationId, id);
  }

  /** Order-dashboard KPIs: today's orders/revenue/AOV + a per-status breakdown. */
  async summary(organizationId: string, storeId?: string) {
    const where: Prisma.OrderWhereInput = {
      organizationId,
      ...(storeId ? { storeId } : {}),
    };
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [grouped, todayOrders, todayAgg] = await Promise.all([
      this.prisma.order.groupBy({ by: ["status"], where, _count: { _all: true } }),
      this.prisma.order.count({ where: { ...where, createdAt: { gte: startOfToday } } }),
      this.prisma.order.aggregate({
        where: { ...where, createdAt: { gte: startOfToday }, status: { not: "cancelled" } },
        _sum: { totalCents: true },
      }),
    ]);
    const byStatus: Record<string, number> = {};
    for (const g of grouped) byStatus[g.status] = g._count._all;
    const todayRevenueCents = todayAgg._sum.totalCents ?? 0;
    const aovCents = todayOrders > 0 ? Math.round(todayRevenueCents / todayOrders) : 0;
    return { todayOrders, todayRevenueCents, aovCents, byStatus };
  }

  /**
   * Allowed order lifecycle transitions. Any active order can be cancelled;
   * a completed order can enter the refund flow. Terminal: cancelled, refunded.
   */
  private canTransition(from: OrderStatus, to: OrderStatus): boolean {
    const flow: Record<OrderStatus, OrderStatus[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      preparing: ["packed", "ready", "cancelled"],
      packed: ["ready", "cancelled"],
      ready: ["out_for_delivery", "completed", "cancelled"],
      out_for_delivery: ["delivered", "cancelled"],
      delivered: ["completed", "refund_requested"],
      completed: ["refund_requested"],
      cancelled: [],
      refund_requested: ["refund_approved", "cancelled"],
      refund_approved: ["refunded"],
      refunded: [],
    };
    return flow[from]?.includes(to) ?? false;
  }
}
