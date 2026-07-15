import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateIntentDto, WebhookDto } from "./dto";

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a pending payment + (stubbed) gateway intent. In Phase 3 this calls
   * the Razorpay SDK to create an order and returns its id/key; here we mint a
   * deterministic gatewayRef the stub webhook can settle against.
   */
  async createIntent(organizationId: string, dto: CreateIntentDto) {
    const { amountCents } = await this.resolveTarget(organizationId, dto);
    const gatewayRef = `rzp_${randomUUID()}`;

    const payment = await this.prisma.payment.create({
      data: {
        organizationId,
        target: dto.target,
        orderId: dto.target === "order" ? dto.orderId! : null,
        posSaleId: dto.target === "pos_sale" ? dto.posSaleId! : null,
        gateway: "razorpay",
        gatewayRef,
        method: dto.method,
        status: "pending",
        amountCents,
      },
    });

    return {
      paymentId: payment.id,
      gatewayRef,
      amountCents,
      currency: "INR",
      // In production: Razorpay order id + key_id for the client SDK.
    };
  }

  /**
   * Gateway webhook — the source of truth for "paid" (PLAN.md §8). Idempotent:
   * settling an already-settled payment is a no-op. On success for an order,
   * advances the order to confirmed.
   */
  async handleWebhook(dto: WebhookDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { gatewayRef: dto.gatewayRef },
    });
    if (!payment) throw new NotFoundException("Unknown gatewayRef");
    if (payment.status !== "pending") return { ok: true, alreadyProcessed: true };

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: dto.status === "paid" ? "paid" : "failed" },
      });
      if (dto.status === "paid" && payment.target === "order" && payment.orderId) {
        await tx.order.update({ where: { id: payment.orderId }, data: { status: "confirmed" } });
      }
    });

    return { ok: true };
  }

  private async resolveTarget(organizationId: string, dto: CreateIntentDto) {
    if (dto.target === "order") {
      if (!dto.orderId) throw new BadRequestException("orderId required for target=order");
      const order = await this.prisma.order.findFirst({
        where: { id: dto.orderId, organizationId },
      });
      if (!order) throw new NotFoundException("Order not found");
      return { amountCents: order.totalCents };
    }
    if (!dto.posSaleId) throw new BadRequestException("posSaleId required for target=pos_sale");
    const sale = await this.prisma.posSale.findFirst({
      where: { id: dto.posSaleId, store: { organizationId } },
    });
    if (!sale) throw new NotFoundException("POS sale not found");
    return { amountCents: sale.totalCents };
  }
}
