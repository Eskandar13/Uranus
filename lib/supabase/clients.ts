import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Supabase clients for server code. Only used when getDataMode() === "supabase".
 *
 *  - publicClient():   anon key, no cookies. Safe inside `'use cache'`. RLS = public read policies.
 *  - sessionClient():  signed-in user's cookies. Use in dashboard pages, server actions. RLS applies.
 *  - serviceClient():  service-role key, BYPASSES RLS. Platform-admin server actions only, after
 *                      requirePlatformAdmin(). Never import from client components.
 */

function url() {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return v;
}
function anonKey() {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  return v;
}

export function publicClient(): SupabaseClient {
  return createClient(url(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function sessionClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(url(), anonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there. The proxy refreshes sessions.
        }
      },
    },
  });
}

export function serviceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (needed for admin actions)");
  return createClient(url(), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Storage bucket for all menu images. Paths: `${restaurantId}/${folder}/${uuid}.webp` */
export const IMAGE_BUCKET = "menu-images";
