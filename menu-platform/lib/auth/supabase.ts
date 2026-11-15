import "server-only";
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { getRepository } from "@/lib/data";
import { APP_URL } from "@/lib/env";
import type { AppUser, Locale, MemberRole } from "@/lib/data/types";
import { serviceClient, sessionClient } from "@/lib/supabase/clients";
import type { AuthErrorCode, SignInResult } from "./types";

/**
 * Supabase-mode auth: Supabase Auth (email + password) with cookies managed by @supabase/ssr.
 * The session cookie is refreshed by proxy.ts on private routes.
 */

/** Where auth emails send people back to: our callback, then the "set your password" page. */
export function authCallbackUrl(lang: Locale, next: string): string {
  return `${APP_URL}/${lang}/auth/callback?next=${encodeURIComponent(next)}`;
}

async function loadAppUser(sb: SupabaseClient, uid: string, email: string): Promise<AppUser> {
  const [members, admin, profile] = await Promise.all([
    sb.from("restaurant_members").select("restaurant_id, role, created_at").eq("user_id", uid).order("created_at"),
    sb.from("platform_admins").select("user_id").eq("user_id", uid).maybeSingle(),
    sb.from("profiles").select("display_name, email").eq("id", uid).maybeSingle(),
  ]);
  if (members.error) console.error("[auth] could not load memberships:", members.error.message);
  if (admin.error) console.error("[auth] could not load platform admin flag:", admin.error.message);

  const rows = (members.data ?? []) as Array<{ restaurant_id: string; role: MemberRole }>;
  const p = profile.data as { display_name: string | null; email: string | null } | null;
  return {
    id: uid,
    email: email || p?.email || "",
    displayName: p?.display_name?.trim() || null,
    isPlatformAdmin: Boolean(admin.data),
    memberships: rows.map((m) => ({ restaurantId: m.restaurant_id, role: m.role === "staff" ? "staff" : "owner" })),
  };
}

export async function supabaseGetCurrentUser(): Promise<AppUser | null> {
  const sb = await sessionClient();
  // getClaims() verifies the JWT (locally with asymmetric keys, else via the Auth server).
  const { data, error } = await sb.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== "string" || !claims.sub) return null;
  return loadAppUser(sb, claims.sub, typeof claims.email === "string" ? claims.email : "");
}

export async function supabaseSignIn(email: string, password: string): Promise<SignInResult> {
  const sb = await sessionClient();
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error || !data.user) {
    const code = error?.code ?? "";
    if (code === "email_not_confirmed" || code === "user_banned") return { ok: false, error: "disabled" };
    if (code === "invalid_credentials" || error?.status === 400) return { ok: false, error: "invalid_credentials" };
    if (error) console.error("[auth] sign-in failed:", error.status, code, error.message);
    return { ok: false, error: "unknown" };
  }
  // The client now holds the new session in memory, so these reads run as the user (RLS).
  return { ok: true, user: await loadAppUser(sb, data.user.id, data.user.email ?? email) };
}

export async function supabaseSignOut(): Promise<void> {
  const sb = await sessionClient();
  await sb.auth.signOut();
}

export async function supabaseSendPasswordReset(email: string, lang: Locale): Promise<{ ok: boolean }> {
  const sb = await sessionClient();
  const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: authCallbackUrl(lang, `/${lang}/auth/update-password`),
  });
  if (error) {
    console.error("[auth] password reset failed:", error.status, error.code, error.message);
    // Unknown emails are not an error for the caller (never reveal which accounts exist).
    return { ok: error.status === 400 || error.status === 404 || error.status === 422 };
  }
  return { ok: true };
}

async function findUserIdByEmail(svc: SupabaseClient, email: string): Promise<string | null> {
  const { data } = await svc.from("profiles").select("id").eq("email", email).limit(1).maybeSingle();
  const fromProfile = (data as { id: string } | null)?.id;
  if (fromProfile) return fromProfile;
  // Fallback: scan auth users (profiles row missing, e.g. created before the trigger existed).
  for (let page = 1; page <= 20; page++) {
    const res = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (res.error) return null;
    const hit = res.data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit.id;
    if (res.data.users.length < 1000) return null;
  }
  return null;
}

/**
 * Sends a Supabase invite (the owner sets a password from the email link) or, when the account
 * already exists, just links it. Uses the service role: callers must have checked
 * requirePlatformAdmin() first (lib/auth/index.ts re-checks it).
 */
export async function supabaseInviteOwner(input: {
  email: string;
  restaurantId: string;
  lang: Locale;
}): Promise<{ ok: true } | { ok: false; error: AuthErrorCode }> {
  const email = input.email.trim().toLowerCase();
  const svc = serviceClient();
  let userId: string | null = null;

  const { data, error } = await svc.auth.admin.inviteUserByEmail(email, {
    redirectTo: authCallbackUrl(input.lang, `/${input.lang}/auth/update-password`),
  });
  if (data?.user?.id) {
    userId = data.user.id;
  } else if (error) {
    const exists = error.code === "email_exists" || error.status === 422 || /already/i.test(error.message);
    if (!exists) {
      console.error("[auth] invite failed:", error.status, error.code, error.message);
      return { ok: false, error: error.status === 429 ? "rate_limited" : "invite_failed" };
    }
    userId = await findUserIdByEmail(svc, email);
  }
  if (!userId) return { ok: false, error: "invite_failed" };

  try {
    const repo = await getRepository("service");
    await repo.addMember(input.restaurantId, userId, "owner");
    return { ok: true };
  } catch (err) {
    console.error("[auth] could not link the owner:", err);
    return { ok: false, error: "unknown" };
  }
}

export async function supabaseUpdatePassword(
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: AuthErrorCode }> {
  const sb = await sessionClient();
  const { data } = await sb.auth.getClaims();
  if (!data?.claims?.sub) return { ok: false, error: "no_session" };
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (!error) return { ok: true };
  if (error.code === "same_password") return { ok: false, error: "same_password" };
  if (error.code === "weak_password") return { ok: false, error: "weak_password" };
  if (error.status === 429) return { ok: false, error: "rate_limited" };
  console.error("[auth] password update failed:", error.status, error.code, error.message);
  return { ok: false, error: "unknown" };
}

/** Auth callback: turns the email link's code or token_hash into a session cookie. */
export async function supabaseExchange(params: {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
}): Promise<boolean> {
  const sb = await sessionClient();
  if (params.code) {
    const { error } = await sb.auth.exchangeCodeForSession(params.code);
    if (error) console.error("[auth] code exchange failed:", error.status, error.code, error.message);
    return !error;
  }
  if (params.tokenHash && params.type) {
    const { error } = await sb.auth.verifyOtp({ token_hash: params.tokenHash, type: params.type as EmailOtpType });
    if (error) console.error("[auth] OTP verification failed:", error.status, error.code, error.message);
    return !error;
  }
  return false;
}
