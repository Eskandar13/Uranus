"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Link2, Loader2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMessages } from "@/components/providers/i18n-provider";
import { checkSlugAction } from "@/app/[lang]/admin/actions";
import { isReservedSlug, isValidSlug } from "@/lib/data/slug";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { SLUG_PLACEHOLDER, type SlugStatus } from "./types";

export type LiveSlugStatus = SlugStatus | "checking" | null;

/** Keeps only slug characters while typing ("My Café" -> "my-caf"). */
export function cleanSlugInput(v: string): string {
  return v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").slice(0, 40);
}

/** Validates locally, then asks the server (debounced) whether the slug is free. */
export function useSlugStatus(lang: Locale, slug: string, exceptId?: string): LiveSlugStatus {
  const local: SlugStatus | null = !slug ? null : !isValidSlug(slug) ? "invalid" : isReservedSlug(slug) ? "reserved" : null;
  const [result, setResult] = useState<{ slug: string; status: SlugStatus } | null>(null);

  useEffect(() => {
    if (!slug || local) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkSlugAction(lang, slug, exceptId)
        .then((status) => {
          if (!cancelled) setResult({ slug, status });
        })
        .catch(() => {
          if (!cancelled) setResult({ slug, status: "available" });
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, local, lang, exceptId]);

  if (!slug) return null;
  if (local) return local;
  return result?.slug === slug ? result.status : "checking";
}

export function SlugField({
  id,
  name,
  value,
  onChange,
  status,
  menuUrlPattern,
  serverError,
  action,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  status: LiveSlugStatus;
  menuUrlPattern: string;
  serverError?: string | null;
  action?: ReactNode;
}) {
  const t = useMessages("admin");
  const bad = status === "taken" || status === "invalid" || status === "reserved" || Boolean(serverError);
  const statusId = `${id}-status`;

  const line = (() => {
    if (serverError) return { icon: <XCircle className="size-3.5" />, text: serverError, tone: "bad" as const };
    switch (status) {
      case "checking":
        return { icon: <Loader2 className="size-3.5 animate-spin" />, text: t.form.slugChecking, tone: "muted" as const };
      case "available":
        return { icon: <CheckCircle2 className="size-3.5" />, text: t.form.slugAvailable, tone: "good" as const };
      case "current":
        return { icon: <CheckCircle2 className="size-3.5" />, text: t.form.slugCurrent, tone: "muted" as const };
      case "taken":
        return { icon: <XCircle className="size-3.5" />, text: t.form.slugTaken, tone: "bad" as const };
      case "reserved":
        return { icon: <CircleAlert className="size-3.5" />, text: t.form.slugReserved, tone: "bad" as const };
      case "invalid":
        return { icon: <CircleAlert className="size-3.5" />, text: t.form.slugInvalid, tone: "bad" as const };
      default:
        return { icon: null, text: t.form.slugHint, tone: "muted" as const };
    }
  })();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{t.form.slug}</Label>
        {action}
      </div>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(cleanSlugInput(e.target.value))}
        dir="ltr"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        minLength={3}
        maxLength={40}
        aria-invalid={bad ? true : undefined}
        aria-describedby={statusId}
        className="h-11 font-mono text-base"
        placeholder="jasmine-cafe"
      />
      <p
        id={statusId}
        aria-live="polite"
        className={cn(
          "flex min-h-5 items-center gap-1.5 text-xs",
          line.tone === "good" && "text-emerald-700 dark:text-emerald-400",
          line.tone === "bad" && "text-destructive",
          line.tone === "muted" && "text-muted-foreground",
        )}
      >
        {line.icon ? <span aria-hidden="true">{line.icon}</span> : null}
        {line.text}
      </p>
      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
        <Link2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="sr-only">{t.form.preview}: </span>
        <span dir="ltr" className="truncate font-mono">
          {menuUrlPattern.replace(SLUG_PLACEHOLDER, value || "…")}
        </span>
      </p>
    </div>
  );
}
