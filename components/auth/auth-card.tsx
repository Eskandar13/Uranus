"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Card that fades/slides in once (no motion when the user prefers reduced motion). */
export function AuthCard({
  title,
  subtitle,
  icon,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn("space-y-6", className)}
      aria-labelledby="auth-title"
    >
      <header className="space-y-2">
        {icon ? (
          <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground">
            {icon}
          </span>
        ) : null}
        <h1 id="auth-title" className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h1>
        {subtitle ? <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p> : null}
      </header>
      {children}
    </motion.section>
  );
}

/** Inline status message (error / success / info) that animates in and is announced. */
export function FormAlert({
  tone = "error",
  message,
  id,
}: {
  tone?: "error" | "success" | "info";
  message: string | null | undefined;
  id?: string;
}) {
  const reduce = useReducedMotion();
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          key={message}
          id={id}
          role={tone === "error" ? "alert" : "status"}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, x: tone === "error" ? [0, -5, 5, -3, 3, 0] : 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-relaxed",
            tone === "error" && "border-destructive/30 bg-destructive/8 text-destructive",
            tone === "success" && "border-emerald-600/25 bg-emerald-600/8 text-emerald-800 dark:text-emerald-300",
            tone === "info" && "border-border bg-muted/60 text-foreground",
          )}
        >
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
