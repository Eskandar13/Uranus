"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Building2, KeyRound, Loader2, Store, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMessages } from "@/components/providers/i18n-provider";
import { signInAction } from "@/lib/auth/actions";
import { fmt, type Locale } from "@/lib/i18n/config";
import { AuthCard, FormAlert } from "./auth-card";
import { PasswordInput } from "./password-input";
import type { DemoAccount, SignInFormState } from "./types";

export function LoginForm({
  lang,
  next,
  linkError,
  demoAccounts,
}: {
  lang: Locale;
  next: string;
  linkError: boolean;
  demoAccounts: DemoAccount[];
}) {
  const t = useMessages("auth");
  const [state, formAction, pending] = useActionState<SignInFormState, FormData>(signInAction, {});
  // Controlled fields: React resets uncontrolled inputs after a form action, and the demo
  // panel fills them in.
  const [email, setEmail] = useState(state.email ?? "");
  const [password, setPassword] = useState("");
  const submitRef = useRef<HTMLButtonElement>(null);

  const error = state.error ? t.errors[state.error] : null;

  function fill(account: DemoAccount) {
    setEmail(account.email);
    setPassword(account.password);
    toast.success(fmt(t.demo.filled, { email: account.email }));
    requestAnimationFrame(() => submitRef.current?.focus());
  }

  return (
    <AuthCard title={t.login.title} subtitle={t.login.subtitle}>
      {demoAccounts.length > 0 ? <DemoAccounts accounts={demoAccounts} onPick={fill} /> : null}

      <form action={formAction} className="space-y-5" aria-describedby={error ? "login-error" : undefined}>
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="next" value={next} />

        <FormAlert id="login-error" message={error ?? (linkError ? t.login.linkError : null)} tone={error ? "error" : "info"} />

        <div className="space-y-2">
          <Label htmlFor="login-email">{t.login.email}</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.login.emailPlaceholder}
            aria-invalid={state.error === "invalid_credentials" || state.error === "invalid" ? true : undefined}
            className="h-11 text-base"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="login-password">{t.login.password}</Label>
            <Link
              href={`/${lang}/auth/forgot-password`}
              className="-my-2 inline-flex h-11 items-center rounded-md px-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {t.login.forgot}
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
            required
            maxLength={256}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.login.passwordPlaceholder}
            showLabel={t.login.showPassword}
            hideLabel={t.login.hidePassword}
            aria-invalid={state.error === "invalid_credentials" ? true : undefined}
          />
        </div>

        <Button ref={submitRef} type="submit" disabled={pending} className="group h-11 w-full text-base" aria-busy={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t.login.submitting}
            </>
          ) : (
            <>
              {t.login.submit}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
            </>
          )}
        </Button>
      </form>
    </AuthCard>
  );
}

function DemoAccounts({ accounts, onPick }: { accounts: DemoAccount[]; onPick: (a: DemoAccount) => void }) {
  const t = useMessages("auth");
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(true);

  return (
    <AnimatePresence initial={false} mode="wait">
      {open ? (
        <motion.div
          key="panel"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-50/70 p-3 dark:bg-amber-500/5"
          role="region"
          aria-labelledby="demo-title"
        >
          <div className="flex items-start justify-between gap-2 ps-1">
            <div className="pt-1">
              <p id="demo-title" className="flex items-center gap-1.5 text-sm font-semibold">
                <KeyRound className="size-4 text-amber-600" aria-hidden="true" />
                {t.demo.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.demo.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.demo.dismiss}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none -me-1.5 -mt-1.5 dark:hover:bg-white/5"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <ul className="mt-2 grid gap-1.5">
            {accounts.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => onPick(a)}
                  aria-label={fmt(t.demo.use, { name: a.displayName })}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-background/80 px-3 py-2 text-start ring-1 ring-black/5 transition hover:bg-background hover:ring-black/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.99] dark:ring-white/10"
                >
                  <span
                    className={
                      a.kind === "admin"
                        ? "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                        : "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    }
                    aria-hidden="true"
                  >
                    {a.kind === "admin" ? <Building2 className="size-4" /> : <Store className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.displayName}</span>
                    <span className="block truncate text-xs text-muted-foreground" dir="ltr">
                      {a.email}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {a.kind === "admin" ? t.demo.admin : t.demo.owner}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </motion.div>
      ) : (
        <motion.div key="show" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <KeyRound className="size-4" aria-hidden="true" />
            {t.demo.show}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
