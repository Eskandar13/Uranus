/**
 * Low-level crypto for local-mode auth: HMAC-signed session tokens and password hashing.
 * Pure Node (node:crypto only, no Next or app imports) so it can be unit-tested with plain node.
 * Server-side only in practice: lib/auth/local.ts is the one caller.
 */
import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

/** Sessions last 14 days. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export interface SessionPayload {
  /** User id. */
  uid: string;
  /** Issued at (seconds since epoch). */
  iat: number;
  /** Expires at (seconds since epoch). */
  exp: number;
}

const MAX_TOKEN_LENGTH = 2048;

function hmac(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(body, "utf8").digest();
}

/** "base64url(JSON payload).base64url(HMAC-SHA256(payload part))" */
export function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${hmac(body, secret).toString("base64url")}`;
}

function isPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.uid === "string" &&
    v.uid.length > 0 &&
    v.uid.length <= 128 &&
    typeof v.iat === "number" &&
    Number.isFinite(v.iat) &&
    typeof v.exp === "number" &&
    Number.isFinite(v.exp)
  );
}

/**
 * Returns the payload when the token is well formed, correctly signed with `secret` and not
 * expired at `nowSeconds`; otherwise null. Signature check uses timingSafeEqual.
 */
export function verifySession(
  token: string | null | undefined,
  secret: string,
  nowSeconds: number,
): SessionPayload | null {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = hmac(body, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isPayload(parsed)) return null;
  if (parsed.exp <= nowSeconds) return null;
  // Tokens "issued in the future" (beyond small clock skew) are rejected too.
  if (parsed.iat > nowSeconds + 300) return null;
  return parsed;
}

/** A fresh payload for `uid`, valid for SESSION_TTL_SECONDS from `nowSeconds`. */
export function newSessionPayload(uid: string, nowSeconds: number): SessionPayload {
  return { uid, iat: nowSeconds, exp: nowSeconds + SESSION_TTL_SECONDS };
}

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

const SCRYPT_KEYLEN = 64;
const SCRYPT_PREFIX = "scrypt$";

function scryptAsync(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** "scrypt$<salt base64url>$<hash base64url>" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return `${SCRYPT_PREFIX}${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function isHashedPassword(stored: string): boolean {
  return stored.startsWith(SCRYPT_PREFIX);
}

/**
 * Checks `password` against a stored value: either an scrypt hash created by hashPassword, or a
 * plaintext demo password from the seed. Both comparisons are constant-time.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  if (isHashedPassword(stored)) {
    const parts = stored.split("$");
    if (parts.length !== 3 || !parts[1] || !parts[2]) return false;
    const salt = Buffer.from(parts[1], "base64url");
    const expected = Buffer.from(parts[2], "base64url");
    if (salt.length < 8 || expected.length < 16) return false;
    const actual = await scryptAsync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  }
  // Plaintext seed password: compare fixed-length digests so the time doesn't leak the length.
  const a = createHash("sha256").update(password, "utf8").digest();
  const b = createHash("sha256").update(stored, "utf8").digest();
  return timingSafeEqual(a, b) && stored.length > 0;
}

const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Random, easy-to-read temporary password (no 0/O, 1/l/I), using a CSPRNG. */
export function generateTempPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  // Guarantee at least one digit so it reads as a password, not a word.
  if (!/[2-9]/.test(out)) out = out.slice(0, -1) + String(randomInt(2, 10));
  return out;
}
