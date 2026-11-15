"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (Supabase mode only), e.g. for the password-reset page. */
export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
