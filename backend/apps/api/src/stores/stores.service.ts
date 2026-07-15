import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateStoreDto, UpdateStoreDto } from "./dto";
import { normalizeConfig } from "./appearance";

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, dto: CreateStoreDto) {
    return this.prisma.store.create({
      data: { organizationId, ...dto },
    });
  }

  list(organizationId: string) {
    return this.prisma.store.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Fetch a store, enforcing tenancy: 404 if it isn't in this org. */
  async get(organizationId: string, id: string) {
    const store = await this.prisma.store.findFirst({ where: { id, organizationId } });
    if (!store) throw new NotFoundException("Store not found");
    return store;
  }

  async update(organizationId: string, id: string, dto: UpdateStoreDto) {
    await this.get(organizationId, id);
    return this.prisma.store.update({ where: { id }, data: dto });
  }

  async updateConfig(organizationId: string, id: string, config: Record<string, unknown>) {
    await this.get(organizationId, id);
    // Sanitize the appearance block (colors, radius, flags) on write so the
    // customer app always reads a complete, valid theme. Unknown keys pass through.
    const clean = normalizeConfig(config);
    return this.prisma.store.update({
      where: { id },
      data: { config: clean as Prisma.InputJsonValue },
    });
  }
}
