import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  CanActivate,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import type { Role } from "@prisma/client";
import { IS_PUBLIC_KEY, ROLES_KEY } from "../common/decorators";
import type { AuthUser } from "../common/auth-user";
import { ApiKeysService } from "../admin/api-keys.service";

/**
 * Global guard: every route requires a valid access token unless marked @Public.
 * Also accepts an `x-api-key` header for programmatic (owner-scoped) access.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeys: ApiKeysService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Programmatic access via API key → owner-scoped principal.
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, unknown>; user?: AuthUser }>();
    const header = req.headers["x-api-key"];
    const apiKey = Array.isArray(header) ? header[0] : header;
    if (typeof apiKey === "string" && apiKey) {
      const principal = await this.apiKeys.resolve(apiKey);
      if (principal) {
        req.user = principal;
        return true;
      }
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}

/** Guard for the refresh endpoint — validates a refresh token instead of access. */
@Injectable()
export class JwtRefreshGuard extends AuthGuard("jwt-refresh") {}

/** Enforces @Roles(...) metadata. Runs after JwtAuthGuard, so req.user is set. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
