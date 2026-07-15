import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from "../common/auth-user";
import type { LoginDto, RegisterDto, TokensDto } from "./dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Create an organization plus its first owner. Returns tokens for that owner. */
  async register(dto: RegisterDto): Promise<TokensDto> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { user } = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: dto.organizationName },
      });
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: dto.email,
          passwordHash,
          name: dto.name,
          role: "owner",
        },
      });
      return { organization, user };
    });
    return this.issueTokens(user.id, user.organizationId, user.role, user.storeId);
  }

  async login(dto: LoginDto): Promise<TokensDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    return this.issueTokens(user.id, user.organizationId, user.role, user.storeId);
  }

  /** Re-issue tokens from a valid refresh token (validated by JwtRefreshGuard). */
  async refresh(userId: string): Promise<TokensDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(user.id, user.organizationId, user.role, user.storeId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        storeId: true,
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private async issueTokens(
    userId: string,
    organizationId: string,
    role: AccessTokenPayload["role"],
    storeId: string | null,
  ): Promise<TokensDto> {
    const accessPayload: AccessTokenPayload = {
      sub: userId,
      org: organizationId,
      role,
      storeId,
    };
    const refreshPayload: RefreshTokenPayload = { sub: userId, org: organizationId };

    type ExpiresIn = JwtSignOptions["expiresIn"];
    const accessOpts: JwtSignOptions = {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: (this.config.get<string>("JWT_ACCESS_TTL") ?? "900s") as ExpiresIn,
    };
    const refreshOpts: JwtSignOptions = {
      secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: (this.config.get<string>("JWT_REFRESH_TTL") ?? "30d") as ExpiresIn,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, accessOpts),
      this.jwt.signAsync(refreshPayload, refreshOpts),
    ]);
    return { accessToken, refreshToken };
  }
}
