import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { RefreshTokenPayload } from "../common/auth-user";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(config: ConfigService) {
    const secret = config.get<string>("JWT_REFRESH_SECRET");
    if (!secret) throw new Error("JWT_REFRESH_SECRET is not set");
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: RefreshTokenPayload): { userId: string; organizationId: string } {
    if (!payload?.sub || !payload?.org) throw new UnauthorizedException();
    return { userId: payload.sub, organizationId: payload.org };
  }
}
