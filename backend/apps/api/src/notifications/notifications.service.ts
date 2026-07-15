import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  async send(
    organizationId: string,
    dto: { title: string; body: string; audience?: string; storeId?: string; scheduledAt?: string },
  ) {
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const notification = await this.prisma.notification.create({
      data: {
        organizationId,
        storeId: dto.storeId ?? null,
        title: dto.title,
        body: dto.body,
        audience: dto.audience ?? "all",
        scheduledAt,
      },
    });
    // Push live only if it's due now (not a future-scheduled one).
    if (!scheduledAt || scheduledAt <= new Date()) {
      this.events.emitToOrg(organizationId, "notification:new", { id: notification.id });
    }
    return notification;
  }

  list(organizationId: string) {
    return this.prisma.notification.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /** Public feed for the customer app — only notifications that are due. */
  feed(organizationId: string, storeId?: string) {
    return this.prisma.notification.findMany({
      where: {
        organizationId,
        OR: [{ storeId: null }, ...(storeId ? [{ storeId }] : [])],
        AND: [{ OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }] }],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}
