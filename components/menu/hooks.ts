"use client";

import { useCallback, useSyncExternalStore } from "react";

/* ------------------------------------------------------------------ */
/* Client-only values without setState-in-effect                       */
/* ------------------------------------------------------------------ */

const noopSubscribe = () => () => {};

/** false during SSR + hydration, true afterwards. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function subscribeMinute(cb: () => void) {
  const id = window.setInterval(cb, 30_000);
  document.addEventListener("visibilitychange", cb);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", cb);
  };
}
const minuteSnapshot = () => Math.floor(Date.now() / 60_000);
const nullSnapshot = () => null;

/** Current time (minute precision) on the client; null on the server. Re-renders every minute. */
export function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribeMinute, minuteSnapshot, nullSnapshot);
  return minute === null ? null : new Date(minute * 60_000);
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* localStorage with an in-memory fallback (private mode, blocked)     */
/* ------------------------------------------------------------------ */

const memory = new Map<string, string>();
const storageListeners = new Set<() => void>();

function readStored(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string | null) {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the in-memory value still works for this visit */
  }
  storageListeners.forEach((l) => l());
}

function subscribeStorage(cb: () => void) {
  storageListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    storageListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Raw stored string (null on the server and when missing). */
export function useStoredString(key: string): string | null {
  return useSyncExternalStore(
    subscribeStorage,
    () => readStored(key),
    () => null,
  );
}

/** A stored choice limited to `allowed` values, with a fallback. */
export function useStoredChoice<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): [T, (value: T) => void] {
  const raw = useStoredString(key);
  const value = raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  const set = useCallback((v: T) => writeStored(key, v), [key]);
  return [value, set];
}

/* ------------------------------------------------------------------ */
/* ?item=<slug> (item sheet) synced with history.replaceState          */
/* ------------------------------------------------------------------ */

const urlListeners = new Set<() => void>();

function subscribeUrl(cb: () => void) {
  urlListeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => {
    urlListeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}

const readItemParam = () => new URLSearchParams(window.location.search).get("item");

export function useItemParam(): string | null {
  return useSyncExternalStore(subscribeUrl, readItemParam, () => null);
}

const SHEET_MARK = "__menuSheet";

/**
 * Opening a dish pushes a history entry (so system Back closes the sheet);
 * switching dishes or closing without our entry uses replaceState.
 */
export function setItemParam(slug: string | null) {
  const url = new URL(window.location.href);
  const hadItem = url.searchParams.has("item");
  const marked = Boolean((window.history.state as Record<string, unknown> | null)?.[SHEET_MARK]);
  if (slug) url.searchParams.set("item", slug);
  else url.searchParams.delete("item");
  if (slug && !hadItem) {
    window.history.pushState({ ...(window.history.state ?? {}), [SHEET_MARK]: true }, "", url);
  } else if (!slug && marked) {
    // popstate listener notifies subscribers once the entry is popped
    window.history.back();
    return;
  } else {
    window.history.replaceState(window.history.state, "", url);
  }
  urlListeners.forEach((l) => l());
}

/* ------------------------------------------------------------------ */
/* URLs built from window.location (work on subdomains and paths)      */
/* ------------------------------------------------------------------ */

/** Same page in the other language: swaps the first path segment (/ar <-> /en). */
export function languageSwitchUrl(target: "ar" | "en"): string {
  const { pathname, search, hash } = window.location;
  const parts = pathname.split("/");
  if (parts[1] === "ar" || parts[1] === "en") parts[1] = target;
  else parts.splice(1, 0, target);
  return `${parts.join("/") || "/"}${search}${hash}`;
}

/** Absolute URL of the menu (current path, without the item query). */
export function menuShareUrl(itemSlug?: string): string {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/item\/[^/]+\/?$/, "");
  if (itemSlug) url.searchParams.set("item", itemSlug);
  return url.toString();
}

/** Path of the menu page from an item page (strips "/item/<slug>"). */
export function menuPathFromLocation(): string {
  return window.location.pathname.replace(/\/item\/[^/]+\/?$/, "") || "/";
}

/** Path of a sibling item page from an item page. */
export function itemPathFromLocation(itemSlug: string): string {
  return `${menuPathFromLocation().replace(/\/$/, "")}/item/${encodeURIComponent(itemSlug)}`;
}
