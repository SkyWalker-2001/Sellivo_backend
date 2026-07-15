import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AccessTokenPayload, AuthUser } from "../common/auth-user";

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: ConfigService) {
    const secret = config.get<string>("JWT_ACCESS_SECRET");
    if (!secret) throw new Error("JWT_ACCESS_SECRET is not set");
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // Return value is attached to req.user.
  validate(payload: AccessTokenPayload): AuthUser {
    if (!payload?.sub || !payload?.org) throw new UnauthorizedException();
    return {
      userId: payload.sub,
      organizationId: payload.org,
      role: payload.role,
      storeId: payload.storeId ?? null,
    };
  }
}
