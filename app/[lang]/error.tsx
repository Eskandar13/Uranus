"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import ar from "@/messages/ar/menu.json";
import en from "@/messages/en/menu.json";
import { dirOf, isLocale } from "@/lib/i18n/config";

/**
 * Localised last-resort boundary for everything under /[lang] (public menu, auth, layouts that
 * throw while loading data). It sits above the area providers, so it reads the strings directly.
 */
export default function LangError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams<{ lang?: string }>();
  const lang = isLocale(params?.lang) ? params.lang : "ar";
  const t = (lang === "ar" ? ar : en).error;
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main dir={dirOf(lang)} className="mx-auto flex min-h-[70svh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
      <h1 className="text-xl font-semibold">{t.title}</h1>
      <p className="text-sm text-muted-foreground">{t.body}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        {t.retry}
      </button>
    </main>
  );
}
