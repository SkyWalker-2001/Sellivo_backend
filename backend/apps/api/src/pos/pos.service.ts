import { randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import type { AuthUser } from "../common/auth-user";
import type { PosSaleDto, SyncPushDto } from "./dto";

export interface SyncPushResult {
  accepted: number;
  duplicates: number;
  saleIds: string[];
}

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  /**
   * Idempotent batch push from an offline POS. Each sale is keyed by clientUuid;
   * replaying the same batch is a no-op (PLAN.md §4). Each sale is committed in
   * its own transaction so one duplicate never aborts the rest of the batch.
   */
  async push(user: AuthUser, dto: SyncPushDto): Promise<SyncPushResult> {
    const saleIds: string[] = [];
    let accepted = 0;
    let duplicates = 0;

    for (const sale of dto.sales) {
      const result = await this.pushOne(user, sale);
      if (result.duplicate) {
        duplicates += 1;
      } else {
        accepted += 1;
      }
      saleIds.push(result.saleId);
    }

    await this.prisma.syncBatch.create({
      data: {
        storeId: dto.sales[0]?.storeId ?? "",
        deviceId: dto.deviceId,
        direction: "push",
        itemCount: dto.sales.length,
      },
    });

    return { accepted, duplicates, saleIds };
  }

  private async pushOne(
    user: AuthUser,
    sale: PosSaleDto,
  ): Promise<{ saleId: string; duplicate: boolean }> {
    // Tenancy: the sale's store must belong to the caller's org.
    const store = await this.prisma.store.findFirst({
      where: { id: sale.storeId, organizationId: user.organizationId },
    });
    if (!store) throw new NotFoundException("Store not found");

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.posSale.findUnique({ where: { clientUuid: sale.clientUuid } });
      if (existing) return { saleId: existing.id, duplicate: true };

      const created = await tx.posSale.create({
        data: {
          storeId: sale.storeId,
          cashierId: user.userId,
          clientUuid: sale.clientUuid,
          subtotalCents: sale.subtotalCents,
          discountCents: sale.discountCents ?? 0,
          taxCents: sale.taxCents ?? 0,
          totalCents: sale.totalCents,
          paymentMethod: sale.paymentMethod ?? "cash",
          customerName: sale.customerName ?? null,
          customerPhone: sale.customerPhone ?? null,
          offlineCreatedAt: new Date(sale.offlineCreatedAt),
          syncedAt: new Date(),
          items: {
            create: sale.items.map((i) => ({
              variantId: i.variantId,
              quantity: i.quantity,
              unitPriceCents: i.unitPriceCents,
              totalCents: i.totalCents,
            })),
          },
        },
      });

      // Append one ledger movement per line, decrementing stock. Movement ids are
      // client-supplied so a re-push is idempotent at the ledger level too.
      for (const item of sale.items) {
        await this.inventory.applyMovement(tx, {
          id: item.movementId ?? randomUUID(),
          storeId: sale.storeId,
          variantId: item.variantId,
          delta: -item.quantity,
          reason: "sale_pos",
          source: "pos",
          refId: created.id,
        });
      }

      return { saleId: created.id, duplicate: false };
    });
  }

  /**
   * Delta pull for a POS device: catalog + prices + best-effort stock changed
   * since `cursor`. Returns a fresh cursor to persist on the device.
   */
  async pull(user: AuthUser, storeId: string, cursor?: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, organizationId: user.organizationId },
    });
    if (!store) throw new NotFoundException("Store not found");

    const since = cursor ? new Date(cursor) : new Date(0);
    const nextCursor = new Date().toISOString();

    const [products, inventory] = await Promise.all([
      this.prisma.product.findMany({
        where: { organizationId: user.organizationId, updatedAt: { gt: since } },
        include: { variants: true },
      }),
      this.prisma.inventory.findMany({
        where: { storeId, updatedAt: { gt: since } },
        select: { variantId: true, onHand: true, updatedAt: true },
      }),
    ]);

    return { nextCursor, products, inventory };
  }
}
