import type { MemberRole, Plan, TemplateId } from "@/lib/data/types";

/**
 * Plain types and constants shared by the admin server actions (app/[lang]/admin/actions.ts)
 * and the admin Client Components. No runtime dependencies on server code.
 */

export type AdminErrorCode =
  | "invalid"
  | "slug_taken"
  | "slug_invalid"
  | "slug_reserved"
  | "domain_taken"
  | "domain_invalid"
  | "not_found"
  | "forbidden"
  | "read_only"
  | "storage_failed"
  | "confirm_mismatch"
  | "invite_failed"
  | "rate_limited"
  | "unknown";

export const ADMIN_ERROR_CODES: readonly AdminErrorCode[] = [
  "invalid",
  "slug_taken",
  "slug_invalid",
  "slug_reserved",
  "domain_taken",
  "domain_invalid",
  "not_found",
  "forbidden",
  "read_only",
  "storage_failed",
  "confirm_mismatch",
  "invite_failed",
  "rate_limited",
  "unknown",
];

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: AdminErrorCode };

/** One restaurant as the admin list shows it. */
export interface RestaurantRow {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  logoUrl: string | null;
  primary: string;
  plan: Plan;
  isActive: boolean;
  customDomain: string | null;
  owners: string[];
  itemCount: number;
  publicUrl: string;
  createdAt: string;
}

export type SlugStatus = "available" | "taken" | "invalid" | "reserved" | "current";

export type NewRestaurantField = "nameAr" | "nameEn" | "slug" | "primary" | "currency" | "template" | "ownerEmail";

export interface OwnerOutcome {
  email: string;
  status: "created" | "linked" | "invited" | "failed";
  /** Local mode, new account only: shown to the admin once. */
  tempPassword?: string;
  error?: AdminErrorCode;
}

export interface CreateRestaurantState {
  ok?: boolean;
  error?: AdminErrorCode;
  field?: NewRestaurantField;
  created?: { id: string; slug: string; nameAr: string; nameEn: string; publicUrl: string };
  owner?: OwnerOutcome;
}

export interface UpdateRestaurantState {
  ok?: boolean;
  error?: AdminErrorCode;
  field?: "slug" | "customDomain" | "plan";
  /** Changes on every completed save so the form can react (toast) once per result. */
  nonce?: number;
}

export interface MemberRow {
  userId: string;
  email: string;
  role: MemberRole;
}

export const PLANS: Plan[] = ["trial", "basic", "pro"];

export const BRAND_PRESETS = [
  "#C2410C",
  "#B91C1C",
  "#BE185D",
  "#7C3AED",
  "#1D4ED8",
  "#0F766E",
  "#15803D",
  "#A16207",
  "#1F2937",
] as const;

export const TEMPLATE_ORDER: TemplateId[] = ["aurora", "noir", "pop"];

/** Placeholder used to build menu-link previews on the client from publicMenuUrl(). */
export const SLUG_PLACEHOLDER = "__slug__";
