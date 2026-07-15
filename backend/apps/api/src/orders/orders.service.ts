import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { OrderStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { EventsGateway } from "../events/events.gateway";
import type { CreateOrderDto } from "./dto";

// Storefront pricing rules (kept here so totals are computed server-side).
const GST_RATE = 0.05; // 5% GST on the discounted subtotal
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
    if (!code) return 0;
    const coupon = await this.prisma.coupon.findFirst({
      where: { organizationId, code: code.trim().toUpperCase(), active: true },
    });
    if (!coupon || subtotalCents < coupon.minSubtotalCents) return 0;
    const raw =
      coupon.type === "percent"
        ? Math.round((subtotalCents * coupon.value) / 100)
        : coupon.value;
    return Math.min(raw, subtotalCents); // never discount below zero
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
    const discountCents = await this.computeDiscountCents(
      organizationId,
      dto.couponCode,
      subtotalCents,
    );
    const taxedBase = subtotalCents - discountCents;
    const taxCents = Math.round(taxedBase * GST_RATE);
    const deliveryFeeCents =
      dto.fulfillmentType === "delivery" && taxedBase < FREE_DELIVERY_THRESHOLD_CENTS
        ? DELIVERY_FEE_CENTS
        : 0;
    const totalCents = taxedBase + taxCents + deliveryFeeCents;

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
          couponCode: discountCents > 0 ? dto.couponCode?.trim().toUpperCase() : null,
          deliveryAddress: dto.deliveryAddress ?? null,
          deliverySlot: dto.deliverySlot ?? null,
          notes: dto.notes ?? null,
          items: { create: lines },
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

  async get(organizationId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId },
      include: { items: true, payments: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  list(organizationId: string) {
    return this.prisma.order.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
  }

  async updateStatus(organizationId: string, id: string, status: OrderStatus) {
    const order = await this.get(organizationId, id);
    if (order.status !== status && !this.canTransition(order.status, status)) {
      throw new BadRequestException(`Cannot move an order from ${order.status} to ${status}`);
    }
    const updated = await this.prisma.order.update({ where: { id }, data: { status } });
    // Notify owner dashboards (and, later, the customer) of the status change.
    this.events.emitToOrg(organizationId, "order:updated", { id: updated.id, status: updated.status });
    return updated;
  }

  /**
   * Allowed order lifecycle transitions. Any active order can be cancelled;
   * a completed order can be refunded. Cancelled/refunded are terminal.
   */
  private canTransition(from: OrderStatus, to: OrderStatus): boolean {
    const flow: Record<OrderStatus, OrderStatus[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: ["out_for_delivery", "completed", "cancelled"],
      out_for_delivery: ["completed", "cancelled"],
      completed: ["refunded"],
      cancelled: [],
      refunded: [],
    };
    return flow[from]?.includes(to) ?? false;
  }
}
