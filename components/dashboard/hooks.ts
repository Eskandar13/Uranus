"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useMessages } from "@/components/providers/i18n-provider";
import type { ActionResult } from "@/lib/dashboard/result";

/** The dashboard dictionary. */
export function useT() {
  return useMessages("dashboard");
}

/** matchMedia as a hook (false during server render and the first client render). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** lg breakpoint (1024px): sidebar layout, dialogs instead of bottom sheets. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

/**
 * Shows a toast for a server action result. Returns true when it succeeded.
 * "readOnly" (demo deployments) gets a friendly warning instead of an error.
 */
export function useFeedback() {
  const t = useT();
  return useCallback(
    (res: ActionResult<unknown> | null | undefined, success?: string): boolean => {
      if (res && res.ok) {
        if (success) toast.success(success);
        return true;
      }
      const key = res?.error ?? "unknown";
      if (key === "readOnly") {
        toast.warning(t.errors.readOnly, { description: t.errors.readOnlyHint, id: "read-only" });
      } else {
        toast.error(t.errors[key] ?? t.errors.unknown);
      }
      return false;
    },
    [t],
  );
}

/** Calls a server action and turns network failures into an "unknown" result. */
export async function callAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    // Redirects (session expired) are handled by the router; anything else is unexpected.
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.error(err);
    return { ok: false, error: "unknown" };
  }
}

/**
 * Warns before leaving with unsaved changes: closing/reloading the tab (beforeunload) and
 * clicking an in-app link (capture-phase click, so next/link never starts the navigation).
 */
export function useUnsavedGuard(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      const a = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}

/** Copies text, with a fallback for older browsers / insecure origins. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const okCopy = document.execCommand("copy");
      ta.remove();
      return okCopy;
    } catch {
      return false;
    }
  }
}
