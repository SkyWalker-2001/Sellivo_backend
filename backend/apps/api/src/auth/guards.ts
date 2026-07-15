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

/** Global guard: every route requires a valid access token unless marked @Public. */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
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
