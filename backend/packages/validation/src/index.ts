/**
 * @sellivo/validation — shared zod schemas used by the API and the Next.js web app.
 *
 * Populated in later Phase 0 steps (login, catalog, sync-push payloads). Kept as an
 * explicit placeholder so the workspace graph is coherent from the start.
 */

import { z } from "zod";

export const roleSchema = z.enum(["owner", "manager", "cashier"]);
export type Role = z.infer<typeof roleSchema>;
