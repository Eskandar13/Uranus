import "server-only";
import type { Locale } from "./config";

/**
 * UI strings live in messages/{ar,en}/{namespace}.json. Each area of the app owns one namespace:
 *   common    -> shared words (save, cancel, language names...)   [owner: core]
 *   menu      -> public menu                                       [owner: menu-ui]
 *   landing   -> platform landing page                             [owner: landing]
 *   auth      -> login / reset password                            [owner: auth-admin]
 *   admin     -> agency admin                                      [owner: auth-admin]
 *   dashboard -> restaurant owner dashboard                        [owner: dashboard]
 * The English file is the source of truth for the TypeScript type; the Arabic file must have
 * exactly the same keys.
 */
const loaders = {
  common: {
    ar: () => import("@/messages/ar/common.json").then((m) => m.default),
    en: () => import("@/messages/en/common.json").then((m) => m.default),
  },
  menu: {
    ar: () => import("@/messages/ar/menu.json").then((m) => m.default),
    en: () => import("@/messages/en/menu.json").then((m) => m.default),
  },
  landing: {
    ar: () => import("@/messages/ar/landing.json").then((m) => m.default),
    en: () => import("@/messages/en/landing.json").then((m) => m.default),
  },
  auth: {
    ar: () => import("@/messages/ar/auth.json").then((m) => m.default),
    en: () => import("@/messages/en/auth.json").then((m) => m.default),
  },
  admin: {
    ar: () => import("@/messages/ar/admin.json").then((m) => m.default),
    en: () => import("@/messages/en/admin.json").then((m) => m.default),
  },
  dashboard: {
    ar: () => import("@/messages/ar/dashboard.json").then((m) => m.default),
    en: () => import("@/messages/en/dashboard.json").then((m) => m.default),
  },
} as const;

export type Namespace = keyof typeof loaders;
export type Messages<N extends Namespace> = Awaited<ReturnType<(typeof loaders)[N]["en"]>>;

export async function getDictionary<N extends Namespace>(locale: Locale, namespace: N): Promise<Messages<N>> {
  return (await loaders[namespace][locale]()) as Messages<N>;
}
