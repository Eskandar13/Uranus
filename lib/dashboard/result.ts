/**
 * Result type of every dashboard server action. Errors are keys into the "errors" object of
 * messages/{ar,en}/dashboard.json, so the client can show a localized message.
 * Pure module (no server-only imports): Client Components import the types and helpers.
 */
export const DASH_ERROR_KEYS = [
  "invalid",
  "notFound",
  "forbidden",
  "readOnly",
  "slugTaken",
  "domainTaken",
  "storageFailed",
  "imageType",
  "imageTooLarge",
  "compressFailed",
  "unknown",
] as const;

export type DashErrorKey = (typeof DASH_ERROR_KEYS)[number];

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: DashErrorKey };

export function isDashErrorKey(value: unknown): value is DashErrorKey {
  return typeof value === "string" && (DASH_ERROR_KEYS as readonly string[]).includes(value);
}
