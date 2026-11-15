"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Messages, Namespace } from "@/lib/i18n/dictionaries";

type AnyMessages = Partial<{ [N in Namespace]: Messages<N> }>;

interface I18nValue {
  lang: Locale;
  dir: "rtl" | "ltr";
  messages: AnyMessages;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Gives Client Components the current language and the dictionary namespaces they need.
 * A Server Component layout loads the namespaces with getDictionary() and passes them in:
 *
 *   <I18nProvider lang={lang} messages={{ common, menu }}>...</I18nProvider>
 *
 * Nested providers merge with their parent, so an inner layout can add namespaces.
 */
export function I18nProvider({
  lang,
  messages,
  children,
}: {
  lang: Locale;
  messages: AnyMessages;
  children: ReactNode;
}) {
  const parent = useContext(I18nContext);
  const value: I18nValue = {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    messages: { ...(parent?.messages ?? {}), ...messages },
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): { lang: Locale; dir: "rtl" | "ltr" } {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return { lang: ctx.lang, dir: ctx.dir };
}

export function useMessages<N extends Namespace>(namespace: N): Messages<N> {
  const ctx = useContext(I18nContext);
  const m = ctx?.messages[namespace];
  if (!m) throw new Error(`Messages namespace "${namespace}" was not provided to <I18nProvider>`);
  return m as Messages<N>;
}
