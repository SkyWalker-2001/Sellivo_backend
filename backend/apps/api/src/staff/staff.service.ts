import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateStaffDto, UpdateStaffDto } from "./dto";

const STAFF_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  storeId: true,
  organizationId: true,
  createdAt: true,
} as const;

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: STAFF_SELECT,
      orderBy: { createdAt: "asc" },
    });
  }

  async create(organizationId: string, dto: CreateStaffDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email already in use");
    if (dto.storeId) await this.assertStore(organizationId, dto.storeId);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        organizationId,
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
        storeId: dto.storeId ?? null,
      },
      select: STAFF_SELECT,
    });
  }

  async update(organizationId: string, id: string, dto: UpdateStaffDto) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) throw new NotFoundException("Staff not found");
    if (user.role === "owner") throw new BadRequestException("Cannot modify the owner here");
    if (dto.storeId) await this.assertStore(organizationId, dto.storeId);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.storeId !== undefined) data.storeId = dto.storeId;
    if (dto.password !== undefined) data.passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.update({ where: { id }, data, select: STAFF_SELECT });
  }

  async remove(organizationId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) throw new NotFoundException("Staff not found");
    if (user.role === "owner") throw new BadRequestException("Cannot delete the owner");
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }

  private async assertStore(organizationId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({ where: { id: storeId, organizationId } });
    if (!store) throw new NotFoundException("Store not found");
  }
}
