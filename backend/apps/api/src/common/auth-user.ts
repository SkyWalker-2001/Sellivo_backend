import type { Role } from "@prisma/client";

/**
 * The authenticated principal, derived from a validated access token.
 * `organizationId` is the tenancy scope applied to every query; `storeId`
 * is set for managers/cashiers and null for owners (PLAN.md §7).
 */
export interface AuthUser {
  userId: string;
  organizationId: string;
  role: Role;
  storeId: string | null;
}

/** JWT access-token payload shape. */
export interface AccessTokenPayload {
  sub: string; // userId
  org: string; // organizationId
  role: Role;
  storeId: string | null;
}

/** JWT refresh-token payload shape. */
export interface RefreshTokenPayload {
  sub: string;
  org: string;
}
