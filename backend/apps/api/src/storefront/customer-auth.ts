import { createParamDecorator, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard, PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

/** The authenticated storefront shopper. */
export interface AuthCustomer {
  customerId: string;
  organizationId: string;
}

export interface CustomerTokenPayload {
  sub: string; // customerId
  org: string; // organizationId
  typ: "customer";
}

/** Separate realm from staff — its own secret so tokens aren't interchangeable. */
@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, "jwt-customer") {
  constructor(config: ConfigService) {
    const secret = config.get<string>("JWT_CUSTOMER_SECRET");
    if (!secret) throw new Error("JWT_CUSTOMER_SECRET is not set");
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: CustomerTokenPayload): AuthCustomer {
    if (payload?.typ !== "customer" || !payload.sub || !payload.org) {
      throw new UnauthorizedException();
    }
    return { customerId: payload.sub, organizationId: payload.org };
  }
}

@Injectable()
export class CustomerAuthGuard extends AuthGuard("jwt-customer") {}

/** Like CustomerAuthGuard but never rejects: attaches the shopper when a valid
 *  token is present, otherwise leaves the request anonymous. Use on endpoints
 *  that work for guests but personalize when signed in. */
@Injectable()
export class OptionalCustomerAuthGuard extends CustomerAuthGuard {
  handleRequest<T = AuthCustomer>(_err: unknown, user: T | false): T | undefined {
    return user || undefined;
  }
}

/** Inject the current shopper (or one of its fields). */
export const CurrentCustomer = createParamDecorator(
  (field: keyof AuthCustomer | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthCustomer }>();
    return field ? req.user?.[field] : req.user;
  },
);
