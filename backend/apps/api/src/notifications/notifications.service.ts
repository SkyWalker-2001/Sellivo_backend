import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  send(organizationId: string, dto: { title: string; body: string; audience?: string; storeId?: string }) {
    return this.prisma.notification.create({
      data: {
        organizationId,
        storeId: dto.storeId ?? null,
        title: dto.title,
        body: dto.body,
        audience: dto.audience ?? "all",
      },
    });
  }

  list(organizationId: string) {
    return this.prisma.notification.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /** Public feed for the customer app (most recent first). */
  feed(organizationId: string, storeId?: string) {
    return this.prisma.notification.findMany({
      where: {
        organizationId,
        OR: [{ storeId: null }, ...(storeId ? [{ storeId }] : [])],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}
