/**
 * Canonical "appearance" contract stored inside a store's `config` JSON.
 *
 * The customer app is themed and gated entirely by this block (brand colors,
 * fonts, corner radius, announcement bar, maintenance mode, feature flags).
 * Owners edit it from the Appearance screen; the customer app reads it via
 * bootstrap. We normalize on write so the shape the client reads is always
 * complete and valid — no matter what an older client or a hand-edited row
 * left behind.
 */

export const FONT_FAMILIES = ["System", "Inter", "Poppins", "Plus Jakarta Sans", "Nunito"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export interface ThemeConfig {
  seedColor: string; // #RRGGBB
  accentColor: string; // #RRGGBB
  fontFamily: FontFamily;
  radius: number; // corner radius, 0..32
  darkDefault: boolean;
}

export interface AnnouncementConfig {
  text: string;
  active: boolean;
  bgColor: string; // #RRGGBB
}

export interface MaintenanceConfig {
  enabled: boolean;
  message: string;
}

export interface AppearanceConfig {
  theme: ThemeConfig;
  announcement: AnnouncementConfig;
  maintenance: MaintenanceConfig;
  flags: Record<string, boolean>;
}

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  theme: {
    seedColor: "#067D62",
    accentColor: "#FFD814",
    fontFamily: "Inter",
    radius: 14,
    darkDefault: false,
  },
  announcement: { text: "", active: false, bgColor: "#067D62" },
  maintenance: { enabled: false, message: "" },
  flags: {},
};

const HEX = /^#?[0-9a-fA-F]{6}$/;

function hex(value: unknown, fallback: string): string {
  if (typeof value === "string" && HEX.test(value.trim())) {
    const v = value.trim();
    return v.startsWith("#") ? v.toUpperCase() : `#${v.toUpperCase()}`;
  }
  return fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeTheme(input: unknown): ThemeConfig {
  const t = asRecord(input);
  const font = FONT_FAMILIES.includes(t.fontFamily as FontFamily)
    ? (t.fontFamily as FontFamily)
    : DEFAULT_APPEARANCE.theme.fontFamily;
  return {
    seedColor: hex(t.seedColor, DEFAULT_APPEARANCE.theme.seedColor),
    accentColor: hex(t.accentColor, DEFAULT_APPEARANCE.theme.accentColor),
    fontFamily: font,
    radius: clamp(t.radius, 0, 32, DEFAULT_APPEARANCE.theme.radius),
    darkDefault: bool(t.darkDefault, DEFAULT_APPEARANCE.theme.darkDefault),
  };
}

function normalizeAnnouncement(input: unknown): AnnouncementConfig {
  // Back-compat: older configs stored `announcement` as a plain string.
  if (typeof input === "string") {
    const text = input.trim();
    return { text, active: text.length > 0, bgColor: DEFAULT_APPEARANCE.announcement.bgColor };
  }
  const a = asRecord(input);
  const text = str(a.text);
  return {
    text,
    active: bool(a.active, text.length > 0),
    bgColor: hex(a.bgColor, DEFAULT_APPEARANCE.announcement.bgColor),
  };
}

function normalizeMaintenance(input: unknown, legacyBool: unknown): MaintenanceConfig {
  // Back-compat: older configs stored `maintenance` as a top-level boolean.
  if (typeof input === "boolean") {
    return { enabled: input, message: DEFAULT_APPEARANCE.maintenance.message };
  }
  const m = asRecord(input);
  return {
    enabled: bool(m.enabled, bool(legacyBool, DEFAULT_APPEARANCE.maintenance.enabled)),
    message: str(m.message),
  };
}

function normalizeFlags(input: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(asRecord(input))) {
    out[k] = bool(v, false);
  }
  return out;
}

/**
 * Merge an incoming config over what's stored, then sanitize the known
 * appearance blocks. Unknown keys (logo, hours, delivery, …) pass through
 * untouched so the config stays a general-purpose store settings bag.
 */
export function normalizeConfig(
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...incoming };
  merged.theme = normalizeTheme(incoming.theme);
  merged.announcement = normalizeAnnouncement(incoming.announcement);
  merged.maintenance = normalizeMaintenance(incoming.maintenance, incoming.maintenance);
  merged.flags = normalizeFlags(incoming.flags);
  return merged;
}
