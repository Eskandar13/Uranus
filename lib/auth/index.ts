import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRepository, RepositoryError } from "@/lib/data";
import { getDataMode } from "@/lib/env";
import type { AppUser, Locale } from "@/lib/data/types";
import type { AuthErrorCode, SignInResult } from "./types";

export type { AuthErrorCode, SignInResult } from "./types";

/**
 * Authentication + authorization API used by the dashboard, admin and server actions.
 * Two implementations behind this one module (chosen by getDataMode()):
 *   - local mode:    demo accounts from the seed + invited owners in .data/db.json,
 *                    HMAC-signed "session" cookie (./local.ts, ./crypto.ts)
 *   - supabase mode: Supabase Auth (email + password, invites, password reset) (./supabase.ts)
 *
 * Every function that reads the session reads cookies, so callers in Server Components must sit
 * inside a <Suspense> boundary (Cache Components rule). Server actions must re-check access
 * themselves (never trust the client).
 */

/** Cookie remembering which restaurant the dashboard shows (validated on every read). */
export const ACTIVE_RESTAURANT_COOKIE = "active_restaurant";

const isLocal = () => getDataMode() === "local";
const local = () => import("./local");
const supa = () => import("./supabase");

/** The signed-in user, or null. Deduplicated per request with React cache(). */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  if (isLocal()) return (await local()).localGetCurrentUser();
  return (await supa()).supabaseGetCurrentUser();
});

/** Member of the restaurant, or platform admin. */
export function canAccessRestaurant(user: AppUser, restaurantId: string): boolean {
  return user.isPlatformAdmin || user.memberships.some((m) => m.restaurantId === restaurantId);
}

function loginPath(lang: Locale, next: string): string {
  return `/${lang}/login?next=${encodeURIComponent(next)}`;
}

/** Signed-in user or redirect to /{lang}/login?next=... (default next: the dashboard). */
export async function requireUser(lang: Locale, next: string = `/${lang}/dashboard`): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(lang, next));
  return user;
}

/** Platform admin (agency) or redirect (login if signed out, dashboard if not admin). */
export async function requirePlatformAdmin(lang: Locale): Promise<AppUser> {
  const user = await requireUser(lang, `/${lang}/admin`);
  if (!user.isPlatformAdmin) redirect(`/${lang}/dashboard`);
  return user;
}

/** User who may manage this restaurant (member of it, or platform admin), else redirect. */
export async function requireRestaurantAccess(lang: Locale, restaurantId: string): Promise<AppUser> {
  const user = await requireUser(lang);
  if (!canAccessRestaurant(user, restaurantId)) redirect(`/${lang}/dashboard`);
  return user;
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Which restaurant the dashboard is showing for this user: the "active_restaurant" cookie if the
 * user may access it, else their first membership, else null (admins with no memberships).
 */
export async function getActiveRestaurantId(user: AppUser): Promise<string | null> {
  const value = (await cookies()).get(ACTIVE_RESTAURANT_COOKIE)?.value;
  if (value && UUID_LIKE.test(value)) {
    if (user.memberships.some((m) => m.restaurantId === value)) return value;
    if (user.isPlatformAdmin) {
      const repo = await getRepository("session");
      if (await repo.getRestaurantById(value)) return value;
    }
  }
  return user.memberships[0]?.restaurantId ?? null;
}

/**
 * Server-action helper: set the active restaurant cookie (after checking access).
 * Throws RepositoryError("forbidden") when signed out or not allowed, "not_found" for an unknown id.
 */
export async function setActiveRestaurantId(restaurantId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new RepositoryError("forbidden", "Not signed in");
  if (!UUID_LIKE.test(restaurantId) || !canAccessRestaurant(user, restaurantId)) {
    throw new RepositoryError("forbidden", "No access to this restaurant");
  }
  if (!user.memberships.some((m) => m.restaurantId === restaurantId)) {
    // Admin acting on any restaurant: make sure it exists.
    const repo = await getRepository("session");
    if (!(await repo.getRestaurantById(restaurantId))) throw new RepositoryError("not_found", "Restaurant not found");
  }
  (await cookies()).set(ACTIVE_RESTAURANT_COOKIE, restaurantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return { ok: false, error: "invalid_credentials" };
  }
  if (isLocal()) return (await local()).localSignIn(email, password);
  return (await supa()).supabaseSignIn(email, password);
}

export async function signOut(): Promise<void> {
  if (isLocal()) await (await local()).localSignOut();
  else await (await supa()).supabaseSignOut();
  (await cookies()).delete(ACTIVE_RESTAURANT_COOKIE);
}

/** Sends a reset link (Supabase) or returns ok in local mode (demo accounts can't reset). */
export async function sendPasswordReset(email: string, lang: Locale): Promise<{ ok: boolean }> {
  if (isLocal()) return { ok: true };
  return (await supa()).supabaseSendPasswordReset(email, lang);
}

/**
 * Creates/invites a restaurant owner account and links it to the restaurant.
 * Supabase: sends an invite email (user sets their password). Local: creates a demo user and
 * returns a temporary password to show the admin once.
 * Re-checks that the caller is a platform admin (it uses elevated credentials).
 */
export async function inviteOwner(input: {
  email: string;
  restaurantId: string;
  lang: Locale;
}): Promise<{ ok: true; tempPassword?: string } | { ok: false; error: string }> {
  const me = await getCurrentUser();
  if (!me?.isPlatformAdmin) return { ok: false, error: "forbidden" satisfies AuthErrorCode };
  if (!input.email?.includes("@") || !UUID_LIKE.test(input.restaurantId)) {
    return { ok: false, error: "invalid" satisfies AuthErrorCode };
  }
  if (isLocal()) return (await local()).localInviteOwner(input);
  return (await supa()).supabaseInviteOwner(input);
}

/**
 * Sets a new password for the signed-in user (after a recovery or invite link in Supabase mode,
 * or from the "change password" page in local mode).
 */
export async function updatePassword(
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: AuthErrorCode }> {
  if (isLocal()) {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "no_session" };
    return (await local()).localUpdatePassword(user.id, newPassword);
  }
  return (await supa()).supabaseUpdatePassword(newPassword);
}

/** Auth email callback (Supabase mode): exchanges the link's code / token_hash for a session. */
export async function completeEmailLink(params: {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
}): Promise<boolean> {
  if (isLocal()) return false;
  return (await supa()).supabaseExchange(params);
}
