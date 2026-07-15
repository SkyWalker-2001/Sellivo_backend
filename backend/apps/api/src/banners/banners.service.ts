import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { UpsertBannerDto } from "./dto";

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public: active, in-schedule banners for the customer app, by priority. */
  async published(organizationId: string, storeId?: string) {
    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        organizationId,
        active: true,
        OR: [{ storeId: null }, ...(storeId ? [{ storeId }] : [])],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return banners.filter(
      (b) => (b.startAt == null || b.startAt <= now) && (b.endAt == null || b.endAt >= now),
    );
  }

  /** Owner: every banner (incl. inactive/scheduled). */
  list(organizationId: string) {
    return this.prisma.banner.findMany({
      where: { organizationId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  }

  create(organizationId: string, dto: UpsertBannerDto) {
    return this.prisma.banner.create({
      data: {
        organizationId,
        imageUrl: dto.imageUrl,
        title: dto.title ?? null,
        subtitle: dto.subtitle ?? null,
        actionType: dto.actionType ?? "none",
        actionValue: dto.actionValue ?? null,
        priority: dto.priority ?? 0,
        active: dto.active ?? true,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpsertBannerDto) {
    await this.assert(organizationId, id);
    return this.prisma.banner.update({
      where: { id },
      data: {
        imageUrl: dto.imageUrl,
        title: dto.title ?? null,
        subtitle: dto.subtitle ?? null,
        actionType: dto.actionType ?? "none",
        actionValue: dto.actionValue ?? null,
        priority: dto.priority ?? 0,
        active: dto.active ?? true,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.assert(organizationId, id);
    await this.prisma.banner.delete({ where: { id } });
    return { deleted: true };
  }

  /** Increment a counter (fire-and-forget analytics from the customer app). */
  async track(id: string, kind: "click" | "impression") {
    await this.prisma.banner
      .update({
        where: { id },
        data: kind === "click" ? { clicks: { increment: 1 } } : { impressions: { increment: 1 } },
      })
      .catch(() => undefined);
    return { ok: true };
  }

  private async assert(organizationId: string, id: string) {
    const b = await this.prisma.banner.findFirst({ where: { id, organizationId } });
    if (!b) throw new NotFoundException("Banner not found");
  }
}
