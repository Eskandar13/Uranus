"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";

const noopSubscribe = () => () => {};
const hasTokenFragment = () => /(^|[#&])access_token=/.test(window.location.hash);

function clearFragment() {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

/**
 * Supabase invite/recovery links that use the implicit flow put the session in the URL fragment
 * (#access_token=...&refresh_token=...), which the server never sees. When the page has such a
 * fragment, store the session in cookies and re-render on the server; otherwise show `children`.
 */
export function HashSessionBridge({ children, loadingLabel }: { children: ReactNode; loadingLabel: string }) {
  const router = useRouter();
  // false on the server and during hydration, then the real value (no hydration mismatch).
  const hasTokens = useSyncExternalStore(noopSubscribe, hasTokenFragment, () => false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasTokens) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    let cancelled = false;
    const fail = () => {
      clearFragment();
      if (!cancelled) setFailed(true);
    };
    if (!access_token || !refresh_token) {
      Promise.resolve().then(fail);
      return;
    }
    browserClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) return fail();
        clearFragment();
        if (!cancelled) router.refresh();
      })
      .catch(fail);
    return () => {
      cancelled = true;
    };
  }, [hasTokens, router]);

  if (hasTokens && !failed) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground" role="status">
        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
        <span className="text-sm">{loadingLabel}</span>
      </div>
    );
  }
  return <>{children}</>;
}
