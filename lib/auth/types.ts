import type { AppUser } from "@/lib/data/types";

/**
 * Plain types shared by the auth implementations, server actions and (as `import type`) the auth
 * Client Components. No runtime code and no server-only imports.
 */

export type SignInResult =
  | { ok: true; user: AppUser }
  | { ok: false; error: "invalid_credentials" | "disabled" | "unknown" };

/** Error codes the auth helpers return (the UI maps each one to a translated message). */
export type AuthErrorCode =
  | "invalid"
  | "read_only"
  | "not_found"
  | "forbidden"
  | "invite_failed"
  | "weak_password"
  | "same_password"
  | "no_session"
  | "rate_limited"
  | "unknown";
