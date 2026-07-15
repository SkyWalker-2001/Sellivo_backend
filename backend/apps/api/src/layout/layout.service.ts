import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { DEFAULT_LAYOUT } from "./default-layout";
import type { CreateSectionDto, UpdateSectionDto } from "./dto";

@Injectable()
export class LayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  // ── Public (customer) ───────────────────────────────────────────────────────
  /**
   * The layout customers render: the published layout for the store (falling
   * back to the org default published layout, then the built-in DEFAULT_LAYOUT).
   * Only enabled + in-schedule sections are returned.
   */
  async getPublished(organizationId: string, storeId?: string) {
    const layout =
      (storeId
        ? await this.prisma.homeLayout.findFirst({
            where: { organizationId, storeId, status: "published" },
            include: { sections: { orderBy: { position: "asc" } } },
          })
        : null) ??
      (await this.prisma.homeLayout.findFirst({
        where: { organizationId, storeId: null, status: "published" },
        include: { sections: { orderBy: { position: "asc" } } },
      }));

    if (!layout) {
      // Never-empty: synthesize the built-in default.
      return {
        source: "default",
        sections: DEFAULT_LAYOUT.map((s, i) => ({
          id: `default-${i}`,
          type: s.type,
          position: i,
          enabled: s.enabled,
          config: s.config,
          dataSource: s.dataSource,
          startAt: null,
          endAt: null,
        })),
      };
    }

    const now = new Date();
    const sections = layout.sections
      .filter((s) => s.enabled)
      .filter((s) => (s.startAt == null || s.startAt <= now) && (s.endAt == null || s.endAt >= now))
      .map(this.serialize);
    return { source: "published", sections };
  }

  // ── Owner (CMS) ───────────────────────────────────────────────────────────────
  /** The editable draft, creating it (seeded from published/default) if absent. */
  async getDraft(organizationId: string, storeId?: string) {
    const layout = await this.ensureDraft(organizationId, storeId ?? null);
    const sections = await this.prisma.layoutSection.findMany({
      where: { layoutId: layout.id },
      orderBy: { position: "asc" },
    });
    return { id: layout.id, storeId: layout.storeId, sections: sections.map(this.serialize) };
  }

  async addSection(organizationId: string, storeId: string | null, dto: CreateSectionDto) {
    const layout = await this.ensureDraft(organizationId, storeId);
    const count = await this.prisma.layoutSection.count({ where: { layoutId: layout.id } });
    const section = await this.prisma.layoutSection.create({
      data: {
        layoutId: layout.id,
        type: dto.type,
        position: count,
        enabled: dto.enabled ?? true,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        dataSource: (dto.dataSource ?? {}) as Prisma.InputJsonValue,
      },
    });
    return this.serialize(section);
  }

  async updateSection(organizationId: string, sectionId: string, dto: UpdateSectionDto) {
    await this.assertSection(organizationId, sectionId);
    const section = await this.prisma.layoutSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.config !== undefined ? { config: dto.config as Prisma.InputJsonValue } : {}),
        ...(dto.dataSource !== undefined
          ? { dataSource: dto.dataSource as Prisma.InputJsonValue }
          : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.startAt !== undefined
          ? { startAt: dto.startAt ? new Date(dto.startAt) : null }
          : {}),
        ...(dto.endAt !== undefined ? { endAt: dto.endAt ? new Date(dto.endAt) : null } : {}),
      },
    });
    return this.serialize(section);
  }

  async deleteSection(organizationId: string, sectionId: string) {
    await this.assertSection(organizationId, sectionId);
    await this.prisma.layoutSection.delete({ where: { id: sectionId } });
    return { deleted: true };
  }

  async duplicateSection(organizationId: string, sectionId: string) {
    const original = await this.assertSection(organizationId, sectionId);
    // Shift everything after the original down by one, then insert the copy.
    await this.prisma.layoutSection.updateMany({
      where: { layoutId: original.layoutId, position: { gt: original.position } },
      data: { position: { increment: 1 } },
    });
    const copy = await this.prisma.layoutSection.create({
      data: {
        layoutId: original.layoutId,
        type: original.type,
        position: original.position + 1,
        enabled: original.enabled,
        config: original.config as Prisma.InputJsonValue,
        dataSource: original.dataSource as Prisma.InputJsonValue,
      },
    });
    return this.serialize(copy);
  }

  async reorder(organizationId: string, storeId: string | null, orderedIds: string[]) {
    const layout = await this.ensureDraft(organizationId, storeId);
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.layoutSection.updateMany({
          where: { id, layoutId: layout.id },
          data: { position: index },
        }),
      ),
    );
    return this.getDraft(organizationId, storeId ?? undefined);
  }

  /** Copy the draft's sections into the published layout (full replace). */
  async publish(organizationId: string, storeId: string | null) {
    const draft = await this.ensureDraft(organizationId, storeId);
    const sections = await this.prisma.layoutSection.findMany({
      where: { layoutId: draft.id },
      orderBy: { position: "asc" },
    });

    // Nullable storeId can't be used in a compound-unique upsert, so find-or-create.
    let published = await this.prisma.homeLayout.findFirst({
      where: { organizationId, storeId, status: "published" },
    });
    published ??= await this.prisma.homeLayout.create({
      data: { organizationId, storeId, status: "published" },
    });

    await this.prisma.$transaction([
      this.prisma.layoutSection.deleteMany({ where: { layoutId: published.id } }),
      ...sections.map((s) =>
        this.prisma.layoutSection.create({
          data: {
            layoutId: published.id,
            type: s.type,
            position: s.position,
            enabled: s.enabled,
            config: s.config as Prisma.InputJsonValue,
            dataSource: s.dataSource as Prisma.InputJsonValue,
            startAt: s.startAt,
            endAt: s.endAt,
          },
        }),
      ),
    ]);
    // Tell connected customer apps to re-fetch their home layout.
    this.events.emitToOrg(organizationId, "layout:published", { storeId });
    return { published: true, sectionCount: sections.length };
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  private async ensureDraft(organizationId: string, storeId: string | null) {
    const existing = await this.prisma.homeLayout.findFirst({
      where: { organizationId, storeId, status: "draft" },
    });
    if (existing) return existing;

    const draft = await this.prisma.homeLayout.create({
      data: { organizationId, storeId, status: "draft" },
    });
    // Seed the draft from the published layout if one exists, else the default.
    const publishedSections = await this.prisma.layoutSection.findMany({
      where: { layout: { organizationId, storeId, status: "published" } },
      orderBy: { position: "asc" },
    });
    const seed =
      publishedSections.length > 0
        ? publishedSections.map((s) => ({
            type: s.type,
            enabled: s.enabled,
            config: s.config as Prisma.InputJsonValue,
            dataSource: s.dataSource as Prisma.InputJsonValue,
          }))
        : DEFAULT_LAYOUT.map((s) => ({
            type: s.type,
            enabled: s.enabled,
            config: s.config as Prisma.InputJsonValue,
            dataSource: s.dataSource as Prisma.InputJsonValue,
          }));
    await this.prisma.layoutSection.createMany({
      data: seed.map((s, i) => ({ ...s, layoutId: draft.id, position: i })),
    });
    return draft;
  }

  private async assertSection(organizationId: string, sectionId: string) {
    const section = await this.prisma.layoutSection.findFirst({
      where: { id: sectionId, layout: { organizationId } },
    });
    if (!section) throw new NotFoundException("Section not found");
    return section;
  }

  private serialize = (s: {
    id: string;
    type: string;
    position: number;
    enabled: boolean;
    config: unknown;
    dataSource: unknown;
    startAt: Date | null;
    endAt: Date | null;
  }) => ({
    id: s.id,
    type: s.type,
    position: s.position,
    enabled: s.enabled,
    config: s.config,
    dataSource: s.dataSource,
    startAt: s.startAt,
    endAt: s.endAt,
  });
}
