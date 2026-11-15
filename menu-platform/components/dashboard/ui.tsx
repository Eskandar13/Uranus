"use client";

import { createElement, useId, type ComponentType, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Loader2, RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { pick } from "@/lib/i18n/config";
import type { LocalizedText } from "@/lib/data/types";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "./hooks";

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 lg:mb-7">
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 lg:min-h-0"
          >
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            {backLabel}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-balance lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-pretty text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card text-card-foreground shadow-xs", className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

export function FieldError({ id, error }: { id?: string; error?: string | null }) {
  const t = useT();
  return (
    <AnimatePresence initial={false}>
      {error && (
        <motion.p
          id={id}
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="text-xs font-medium text-destructive"
        >
          {(t.validation as Record<string, string>)[error] ?? t.validation.invalid}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[0.82rem]">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">({t.common.optional})</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError id={htmlFor ? `${htmlFor}-error` : undefined} error={error} />
    </div>
  );
}

/** Bigger touch-friendly input (44px on phones). */
export const inputClass = "h-11 rounded-xl text-base lg:h-10 lg:text-sm";

/** Arabic and English inputs for one LocalizedText (side by side from sm). */
export function LocalizedFields({
  label,
  value,
  onChange,
  errors,
  errorKey,
  multiline = false,
  maxLength,
  placeholder,
  optional,
  hint,
}: {
  label: ReactNode;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  errors?: Record<string, string>;
  /** Field path prefix in `errors` (e.g. "name"). */
  errorKey?: string;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: { ar?: string; en?: string };
  optional?: boolean;
  hint?: ReactNode;
}) {
  const t = useT();
  const id = useId();
  const groupError = errorKey ? (errors?.[`${errorKey}.ar`] ?? errors?.[errorKey] ?? errors?.[`${errorKey}.en`]) : undefined;
  const langs = [
    { key: "ar" as const, label: t.common.arabic, dir: "rtl" as const },
    { key: "en" as const, label: t.common.english, dir: "ltr" as const },
  ];
  return (
    <fieldset className="@container flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 flex items-center gap-2 text-[0.82rem] font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">({t.common.optional})</span>}
      </legend>
      <div className="grid gap-2 @lg:grid-cols-2">
        {langs.map((l) => {
          const fieldId = `${id}-${l.key}`;
          const common = {
            id: fieldId,
            dir: l.dir,
            lang: l.key,
            value: value[l.key],
            maxLength,
            placeholder: placeholder?.[l.key],
            "aria-invalid": Boolean(groupError) || undefined,
            "aria-describedby": groupError ? `${id}-error` : undefined,
            onChange: (e: { target: { value: string } }) => onChange({ ...value, [l.key]: e.target.value }),
          };
          return (
            <div key={l.key} className="relative" dir={l.dir}>
              <label htmlFor={fieldId} className="sr-only">
                {label} ({l.label})
              </label>
              <span
                aria-hidden
                className="pointer-events-none absolute top-2 end-2 z-10 rounded-md bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {l.key === "ar" ? "ع" : "EN"}
              </span>
              {multiline ? (
                <Textarea {...common} rows={3} className="min-h-24 rounded-xl pe-10 text-base lg:text-sm" />
              ) : (
                <Input {...common} className={cn(inputClass, "pe-10")} />
              )}
            </div>
          );
        })}
      </div>
      {hint && !groupError && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError id={`${id}-error`} error={groupError} />
    </fieldset>
  );
}

/**
 * Converts Arabic-Indic / Persian digits to Latin and the Arabic decimal separator to ".".
 * A comma is a decimal separator when it is followed by 1-2 digits at the end ("12,5" -> 12.5,
 * "2,50" -> 2.5) and a thousands separator otherwise ("32,500" -> 32500).
 */
export function toLatinDigits(value: string): string {
  let s = value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/[،٬]/g, ",");
  if (!s.includes(".")) {
    const m = /^(.*),(\d{1,2})$/.exec(s);
    if (m) s = `${m[1].replace(/,/g, "")}.${m[2]}`;
  }
  return s.replace(/[^\d.]/g, "");
}

/** Parses a price/number typed by the owner; null when empty or invalid. */
export function parseNumber(value: string): number | null {
  const clean = toLatinDigits(value);
  if (!clean) return null;
  const n = Number.parseFloat(clean);
  return Number.isFinite(n) ? n : null;
}

/** Numeric text input that accepts Arabic digits and keeps the raw text while typing. */
export function NumberField({
  id,
  value,
  onChange,
  suffix,
  invalid,
  describedBy,
  className,
  placeholder,
  integer = false,
  ...rest
}: {
  id?: string;
  value: string;
  onChange: (raw: string) => void;
  suffix?: ReactNode;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  placeholder?: string;
  integer?: boolean;
  "aria-label"?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        dir="ltr"
        inputMode={integer ? "numeric" : "decimal"}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          const raw = toLatinDigits(e.target.value);
          onChange(integer ? raw.replace(/\./g, "") : raw.replace(/(\..*)\./g, "$1"));
        }}
        className={cn(inputClass, "text-start tabular-nums", suffix ? "pe-14" : undefined, className)}
        {...rest}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-medium text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Save bar                                                            */
/* ------------------------------------------------------------------ */

/**
 * Sticky bar with Save / Discard. Floats above the phone bottom navigation and sticks to the
 * bottom of the content column on desktop.
 */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  saveLabel,
  alwaysVisible = false,
  form,
}: {
  dirty: boolean;
  saving: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
  saveLabel?: string;
  alwaysVisible?: boolean;
  /** id of the <form> to submit (when the button should submit a form). */
  form?: string;
}) {
  const t = useT();
  const show = alwaysVisible || dirty || saving;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          className="dash-savebar sticky z-30 mt-6 flex items-center gap-2 rounded-2xl border bg-background/90 p-2 ps-4 shadow-lg backdrop-blur-md supports-backdrop-filter:bg-background/75"
        >
          <p className="me-auto flex min-w-0 items-center gap-2 text-sm font-medium" aria-live="polite">
            <span className={cn("size-2 shrink-0 rounded-full", dirty ? "bg-amber-500" : "bg-emerald-500")} aria-hidden />
            <span className="truncate">{dirty ? t.common.unsaved : t.common.saved}</span>
          </p>
          {onDiscard && dirty && (
            <Button type="button" variant="ghost" className="h-11 rounded-xl px-3 lg:h-9" onClick={onDiscard} disabled={saving}>
              <RotateCcw aria-hidden />
              <span className="max-sm:sr-only">{t.common.discard}</span>
            </Button>
          )}
          <Button
            type={form ? "submit" : "button"}
            form={form}
            onClick={onSave}
            disabled={saving || (!dirty && !alwaysVisible)}
            className="h-11 min-w-28 rounded-xl px-4 lg:h-9"
          >
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            {saving ? t.common.saving : (saveLabel ?? t.common.saveChanges)}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function RestaurantAvatar({
  name,
  logoUrl,
  color,
  className,
  size = 40,
}: {
  name: LocalizedText;
  logoUrl: string | null;
  color?: string;
  className?: string;
  size?: number;
}) {
  const { lang } = useI18n();
  const label = pick(name, lang);
  const initial = Array.from(label.trim())[0] ?? "؟";
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted font-bold", className)}
      style={{ width: size, height: size, background: logoUrl ? undefined : color, color: logoUrl ? undefined : "#fff" }}
      aria-hidden
    >
      {logoUrl ? (
        <Image src={logoUrl} alt="" fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <span style={{ fontSize: size * 0.42 }}>{initial}</span>
      )}
    </span>
  );
}

export function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold",
        active
          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-500/15 text-amber-800 dark:text-amber-300",
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-emerald-500" : "bg-amber-500")} aria-hidden />
      {label}
    </span>
  );
}

/** Friendly empty state with a soft illustration. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center", className)}
    >
      <span className="relative grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-100 to-rose-100 text-amber-700 dark:from-amber-500/15 dark:to-rose-500/15 dark:text-amber-300">
        {createElement(icon, { className: "size-7", strokeWidth: 1.6 })}
        <span className="absolute -end-1 -top-1 size-3 rounded-full bg-amber-400/70" aria-hidden />
      </span>
      <div className="max-w-sm">
        <h3 className="font-semibold text-balance">{title}</h3>
        {body && <p className="mt-1 text-sm text-pretty text-muted-foreground">{body}</p>}
      </div>
      {action}
    </motion.div>
  );
}

/** Thumbnail for an item/category photo (or a soft placeholder). */
export function Thumb({
  src,
  blur,
  alt = "",
  className,
  sizes = "64px",
  fallback,
}: {
  src: string | null;
  blur?: string | null;
  alt?: string;
  className?: string;
  sizes?: string;
  fallback?: ReactNode;
}) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-xl bg-muted", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          placeholder={blur ? "blur" : "empty"}
          blurDataURL={blur ?? undefined}
          className="object-cover"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-muted-foreground/60">{fallback}</span>
      )}
    </span>
  );
}
