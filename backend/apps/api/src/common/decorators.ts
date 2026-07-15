import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Role } from "@prisma/client";
import type { AuthUser } from "./auth-user";

/** Mark a route as not requiring authentication (skips the global JwtAuthGuard). */
export const IS_PUBLIC_KEY = "isPublic";
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Restrict a route to specific roles (enforced by RolesGuard). */
export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/** Inject the authenticated principal (or one of its fields) into a handler. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return field ? req.user?.[field] : req.user;
  },
);

/** Shorthand for the tenancy scope: the current organizationId. */
export const CurrentOrg = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
  return req.user?.organizationId;
});
