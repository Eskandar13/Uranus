"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/components/providers/i18n-provider";
import { fmt, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { ADMIN_ERROR_CODES, type AdminErrorCode } from "./types";

/** Maps an admin error code to its translated message. */
export function useAdminErrorMessage() {
  const t = useMessages("admin");
  return (code: string | null | undefined): string => {
    if (!code) return t.errors.unknown;
    return (ADMIN_ERROR_CODES as readonly string[]).includes(code) ? t.errors[code as AdminErrorCode] : t.errors.unknown;
  };
}

/** Dates in UTC so server and client render the same string (Latin digits in Arabic). */
export function formatDate(iso: string, lang: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-u-nu-latn" : "en", { dateStyle: "medium", timeZone: "UTC" }).format(d);
}

/** Logo, or the first letter on the brand color. */
export function RestaurantAvatar({
  name,
  logoUrl,
  color,
  size = 48,
  className,
}: {
  name: string;
  logoUrl: string | null;
  color: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (logoUrl) {
    return (
      <span className={cn("relative block shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-black/5", className)} style={style}>
        <Image
          src={logoUrl}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized={logoUrl.endsWith(".svg")}
        />
      </span>
    );
  }
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-xl font-semibold text-white ring-1 ring-black/5", className)}
      style={{ ...style, backgroundColor: /^#[0-9a-f]{6}$/i.test(color) ? color : "#1f5c46", fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-8">
      <div className="min-w-0 space-y-1.5">
        {eyebrow}
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** One-time temporary password with a copy button (local mode invites). */
export function TempPasswordCard({ email, password }: { email: string; password: string }) {
  const t = useMessages("admin");
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success(t.new.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t.errors.unknown);
    }
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber-500/40 bg-amber-50 p-4 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100"
      role="status"
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="size-4" aria-hidden="true" />
        <span dir="auto">{fmt(t.new.tempPasswordTitle, { email })}</span>
      </p>
      <p className="mt-1 text-xs opacity-80">{t.new.tempPasswordBody}</p>
      <div className="mt-3 flex items-center gap-2">
        <code
          dir="ltr"
          className="flex h-11 min-w-0 flex-1 items-center rounded-lg bg-white/80 px-3 font-mono text-base tracking-wider select-all dark:bg-black/30"
        >
          {password}
        </code>
        <Button type="button" variant="outline" className="h-11 gap-2 bg-white/80 dark:bg-black/30" onClick={copy}>
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          <span className="sr-only sm:not-sr-only">{copied ? t.new.copied : t.new.copy}</span>
        </Button>
      </div>
    </motion.div>
  );
}

/** Section card used by the admin forms. */
export function SectionCard({
  title,
  description,
  children,
  tone = "default",
  id,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "danger";
  id?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "rounded-2xl border bg-background p-5 shadow-xs sm:p-6",
        tone === "danger" && "border-destructive/30",
      )}
    >
      <header className="mb-5 space-y-1">
        <h2 id={id} className={cn("text-base font-semibold", tone === "danger" && "text-destructive")}>
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
