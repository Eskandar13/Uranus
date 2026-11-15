/** Form states shared by the auth server actions (lib/auth/actions.ts) and the auth forms. */

export type SignInFormError = "invalid" | "invalid_credentials" | "disabled" | "unknown";

export interface SignInFormState {
  error?: SignInFormError;
  /** Echo of the typed email so the field keeps its value after an error. */
  email?: string;
}

export interface ResetFormState {
  status: "idle" | "sent" | "error";
  error?: "invalid" | "unknown";
  email?: string;
}

export type UpdatePasswordError =
  | "too_short"
  | "mismatch"
  | "no_session"
  | "same_password"
  | "weak_password"
  | "read_only"
  | "rate_limited"
  | "unknown";

export interface UpdatePasswordFormState {
  ok?: boolean;
  error?: UpdatePasswordError;
  /** Where to go after a successful change. */
  redirectTo?: string;
}

/** A demo login shown on the login page in local mode (one-click fill). */
export interface DemoAccount {
  email: string;
  password: string;
  displayName: string;
  kind: "admin" | "owner";
}
