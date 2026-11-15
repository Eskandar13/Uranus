import { isReadOnlyHost } from "@/lib/data/local/store";

/**
 * Whether published seed credentials (plaintext demo passwords) may be shown and accepted.
 * Allowed outside production, on the read-only public demo host, or with an explicit DEMO_MODE=1.
 * A writable production deployment must never accept them.
 */
export function demoLoginAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.DEMO_MODE === "1") return true;
  return isReadOnlyHost();
}
