import "server-only";
import { getDataMode } from "@/lib/env";
import type { MenuRepository, RepositoryScope } from "./repository";

export * from "./repository";

/**
 * Returns the repository for the current data mode (local JSON store or Supabase).
 * See RepositoryScope in ./repository.ts for which scope to use where:
 *  - "public":  inside `'use cache'` (no cookies). Read-only public data.
 *  - "session": dashboard pages + server actions (signed-in user's cookies; RLS applies).
 *  - "service": platform-admin server actions only, after requirePlatformAdmin().
 *
 * Local mode ignores the scope (authorization is enforced by lib/auth in the callers).
 */
export async function getRepository(scope: RepositoryScope = "session"): Promise<MenuRepository> {
  if (getDataMode() === "local") {
    const { localRepository } = await import("./local/repository");
    return localRepository;
  }
  const [{ createSupabaseRepository }, clients] = await Promise.all([
    import("./supabase/repository"),
    import("@/lib/supabase/clients"),
  ]);
  const client =
    scope === "public"
      ? clients.publicClient()
      : scope === "service"
        ? clients.serviceClient()
        : await clients.sessionClient();
  return createSupabaseRepository(client);
}
