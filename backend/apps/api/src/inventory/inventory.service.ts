import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { MovementReason, MovementSource, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateMovementDto } from "./dto";

/** A single ledger entry to apply. `id` is client-supplied for offline POS idempotency. */
export interface MovementInput {
  id?: string;
  storeId: string;
  variantId: string;
  delta: number;
  reason: MovementReason;
  source: MovementSource;
  refId?: string | null;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apply one movement inside a transaction: append the append-only ledger row
   * and update the cached on-hand total. Idempotent on the movement id — if a
   * row with that id already exists (offline replay), it is skipped and the
   * cached total is left untouched. Reused by both manual movements and POS sync.
   */
  async applyMovement(
    tx: Prisma.TransactionClient,
    m: MovementInput,
  ): Promise<{ applied: boolean }> {
    const id = m.id ?? randomUUID();
    const existing = await tx.inventoryMovement.findUnique({ where: { id } });
    if (existing) return { applied: false };

    await tx.inventoryMovement.create({
      data: {
        id,
        storeId: m.storeId,
        variantId: m.variantId,
        delta: m.delta,
        reason: m.reason,
        source: m.source,
        refId: m.refId ?? null,
      },
    });
    await tx.inventory.upsert({
      where: { storeId_variantId: { storeId: m.storeId, variantId: m.variantId } },
      create: { storeId: m.storeId, variantId: m.variantId, onHand: m.delta },
      update: { onHand: { increment: m.delta } },
    });
    return { applied: true };
  }

  /** Owner-app manual movement (restock / adjustment / return). */
  async createMovement(organizationId: string, dto: CreateMovementDto) {
    await this.assertStore(organizationId, dto.storeId);
    await this.assertVariant(organizationId, dto.variantId);
    if (dto.delta === 0) throw new BadRequestException("delta must be non-zero");

    return this.prisma.$transaction(async (tx) => {
      await this.applyMovement(tx, {
        storeId: dto.storeId,
        variantId: dto.variantId,
        delta: dto.delta,
        reason: dto.reason,
        source: "owner_app",
      });
      return tx.inventory.findUnique({
        where: { storeId_variantId: { storeId: dto.storeId, variantId: dto.variantId } },
      });
    });
  }

  /** Current on-hand for every stocked variant in a store. */
  async storeInventory(organizationId: string, storeId: string) {
    await this.assertStore(organizationId, storeId);
    return this.prisma.inventory.findMany({
      where: { storeId },
      include: { variant: { include: { product: true } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  /**
   * Ledger history for a store — the audit trail of every stock movement.
   * Optionally filtered to a single variant. Newest first.
   */
  async movements(
    organizationId: string,
    storeId: string,
    opts: { variantId?: string; take?: number } = {},
  ) {
    await this.assertStore(organizationId, storeId);
    return this.prisma.inventoryMovement.findMany({
      where: { storeId, ...(opts.variantId ? { variantId: opts.variantId } : {}) },
      include: { variant: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      take: Math.min(opts.take ?? 100, 500),
    });
  }

  private async assertStore(organizationId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({ where: { id: storeId, organizationId } });
    if (!store) throw new NotFoundException("Store not found");
  }

  private async assertVariant(organizationId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, product: { organizationId } },
    });
    if (!variant) throw new NotFoundException("Variant not found");
  }
}
