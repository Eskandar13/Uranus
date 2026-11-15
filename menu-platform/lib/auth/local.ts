import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { RepositoryError } from "@/lib/data/repository";
import { readDb, updateDb, type LocalDb } from "@/lib/data/local/store";
import type { AppUser } from "@/lib/data/types";
import {
  generateTempPassword,
  hashPassword,
  newSessionPayload,
  SESSION_TTL_SECONDS,
  signSession,
  isHashedPassword,
  verifyPassword,
  verifySession,
} from "./crypto";
import { demoLoginAllowed } from "./demo";
import type { AuthErrorCode, SignInResult } from "./types";

/**
 * Local-mode auth: users live in the local JSON store (seed demo accounts + invited owners).
 * The session is an HMAC-signed cookie "session" = base64url(payload).signature, see ./crypto.ts.
 */

export const SESSION_COOKIE = "session";

const DEV_FALLBACK_SECRET = "menu-platform-local-dev-session-secret::not-for-production";
const EXAMPLE_SECRET = "change-me-to-a-long-random-string";

const warned = globalThis as typeof globalThis & { __menuAuthSecretWarned?: boolean };

function warnOnce(message: string) {
  if (warned.__menuAuthSecretWarned) return;
  warned.__menuAuthSecretWarned = true;
  console.warn(`[auth] ${message}`);
}

/**
 * The cookie-signing secret, or null when sign-in must be refused (production without a real
 * SESSION_SECRET: a known secret would let anyone forge an admin session).
 */
function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();
  const production = process.env.NODE_ENV === "production";
  if (secret && (!production || (secret.length >= 16 && secret !== EXAMPLE_SECRET))) return secret;
  if (production) {
    warnOnce("SESSION_SECRET is missing or uses the example value. Local sign-in is disabled until it is set.");
    return null;
  }
  warnOnce("SESSION_SECRET is not set. Using a development-only fallback secret for the demo login cookie.");
  return DEV_FALLBACK_SECRET;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function toAppUser(db: LocalDb, uid: string): AppUser | null {
  const u = db.users.find((x) => x.id === uid);
  if (!u) return null;
  const restaurantIds = new Set(db.restaurants.map((r) => r.id));
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName?.trim() || null,
    isPlatformAdmin: db.platformAdminIds.includes(u.id),
    memberships: db.memberships
      .filter((m) => m.userId === u.id && restaurantIds.has(m.restaurantId))
      .map((m) => ({ restaurantId: m.restaurantId, role: m.role })),
  };
}

export async function localGetCurrentUser(): Promise<AppUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const secret = sessionSecret();
  if (!secret) return null;
  // Expiry depends on the current time: mark this as request-time work before reading the clock.
  await connection();
  const payload = verifySession(token, secret, nowSeconds());
  if (!payload) return null;
  const db = await readDb();
  // A password change signs out every session issued before it (other devices, stolen cookies).
  const changedAt = db.users.find((u) => u.id === payload.uid)?.passwordChangedAt;
  if (changedAt && payload.iat < changedAt) return null;
  return toAppUser(db, payload.uid);
}

function setSessionCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, uid: string, secret: string) {
  cookieStore.set(SESSION_COOKIE, signSession(newSessionPayload(uid, nowSeconds()), secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function localSignIn(email: string, password: string): Promise<SignInResult> {
  const secret = sessionSecret();
  if (!secret) return { ok: false, error: "disabled" };

  const db = await readDb();
  const wanted = normalizeEmail(email);
  const user = db.users.find((u) => normalizeEmail(u.email) === wanted);
  // Always run a comparison so unknown emails take about as long as wrong passwords.
  const valid = await verifyPassword(password, user?.password ?? "\u0000no-such-user\u0000");
  // Plaintext (published seed) passwords only work where demo login is allowed.
  const seedBlocked = !!user && !isHashedPassword(user.password) && !demoLoginAllowed();
  if (!user || !valid || seedBlocked) return { ok: false, error: "invalid_credentials" };

  const appUser = toAppUser(db, user.id);
  if (!appUser) return { ok: false, error: "unknown" };

  setSessionCookie(await cookies(), user.id, secret);
  return { ok: true, user: appUser };
}

export async function localSignOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

function codeOf(err: unknown): AuthErrorCode {
  if (err instanceof RepositoryError) {
    if (err.code === "read_only" || err.code === "not_found" || err.code === "invalid" || err.code === "forbidden") {
      return err.code;
    }
  }
  return "unknown";
}

/**
 * Creates the owner account when missing (random 12-character temporary password, stored hashed)
 * and links it to the restaurant as "owner". The temporary password is returned only when the
 * account was created now, so the admin can hand it over once.
 */
export async function localInviteOwner(input: {
  email: string;
  restaurantId: string;
}): Promise<{ ok: true; tempPassword?: string } | { ok: false; error: AuthErrorCode }> {
  const email = normalizeEmail(input.email);
  const tempPassword = generateTempPassword(12);
  const hashed = await hashPassword(tempPassword);
  try {
    const created = await updateDb((db) => {
      if (!db.restaurants.some((r) => r.id === input.restaurantId)) {
        throw new RepositoryError("not_found", "Restaurant not found");
      }
      let user = db.users.find((u) => normalizeEmail(u.email) === email);
      let isNew = false;
      if (!user) {
        user = { id: randomUUID(), email, password: hashed, displayName: email.split("@")[0] ?? email };
        db.users.push(user);
        isNew = true;
      }
      const userId = user.id;
      const existing = db.memberships.find((m) => m.userId === userId && m.restaurantId === input.restaurantId);
      if (existing) existing.role = "owner";
      else db.memberships.push({ userId, restaurantId: input.restaurantId, role: "owner" });
      return isNew;
    });
    return created ? { ok: true, tempPassword } : { ok: true };
  } catch (err) {
    return { ok: false, error: codeOf(err) };
  }
}

/** Changes the password of a local user (stored as an scrypt hash). */
export async function localUpdatePassword(
  userId: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: AuthErrorCode }> {
  const hashed = await hashPassword(newPassword);
  try {
    const changedAt = nowSeconds();
    await updateDb((db) => {
      const user = db.users.find((u) => u.id === userId);
      if (!user) throw new RepositoryError("not_found", "User not found");
      user.password = hashed;
      user.passwordChangedAt = changedAt;
    });
    // Keep THIS browser signed in with a fresh session (issued at/after the change).
    const secret = sessionSecret();
    if (secret) setSessionCookie(await cookies(), userId, secret);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: codeOf(err) };
  }
}
