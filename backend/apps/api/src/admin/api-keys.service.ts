import { createHash, randomBytes } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../common/auth-user";

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a key. The plaintext is returned ONCE — only its hash is stored. */
  async create(organizationId: string, name: string) {
    const raw = `sk_live_${randomBytes(24).toString("hex")}`;
    const key = await this.prisma.apiKey.create({
      data: {
        organizationId,
        name,
        prefix: raw.slice(0, 16),
        keyHash: hashKey(raw),
      },
    });
    return { id: key.id, name: key.name, prefix: key.prefix, createdAt: key.createdAt, key: raw };
  }

  list(organizationId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async revoke(organizationId: string, id: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, organizationId } });
    if (!key) throw new NotFoundException("API key not found");
    await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    return { revoked: true };
  }

  /**
   * Resolve an `x-api-key` header to a tenant principal (owner-scoped), or null
   * if the key is unknown/revoked. Bumps lastUsedAt (best-effort).
   */
  async resolve(rawKey: string): Promise<AuthUser | null> {
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash: hashKey(rawKey) } });
    if (!key || key.revokedAt) return null;
    this.prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    return {
      userId: `apikey:${key.id}`,
      organizationId: key.organizationId,
      role: "owner",
      storeId: null,
    };
  }
}
