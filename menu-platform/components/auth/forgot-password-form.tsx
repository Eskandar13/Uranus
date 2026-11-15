"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Loader2, MailCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMessages } from "@/components/providers/i18n-provider";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { fmt, type Locale } from "@/lib/i18n/config";
import { AuthCard, FormAlert } from "./auth-card";
import type { ResetFormState } from "./types";

export function ForgotPasswordForm({ lang }: { lang: Locale }) {
  const t = useMessages("auth");
  const reduce = useReducedMotion();
  const [state, formAction, pending] = useActionState<ResetFormState, FormData>(requestPasswordResetAction, {
    status: "idle",
  });
  const [email, setEmail] = useState("");
  // The "sent" state object the user chose to leave (to type another email).
  const [left, setLeft] = useState<ResetFormState | null>(null);
  const sent = state.status === "sent" && state !== left;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {sent ? (
        <motion.div
          key="sent"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <AuthCard
            title={t.forgot.sentTitle}
            subtitle={fmt(t.forgot.sent, { email: state.email ?? email })}
            icon={<MailCheck className="size-6 text-emerald-600" aria-hidden="true" />}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="h-11 flex-1">
                <Link href={`/${lang}/login`}>{t.forgot.backToLogin}</Link>
              </Button>
              <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setLeft(state)}>
                {t.forgot.sendAgain}
              </Button>
            </div>
          </AuthCard>
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <AuthCard title={t.forgot.title} subtitle={t.forgot.subtitle}>
            <form action={formAction} className="space-y-5">
              <input type="hidden" name="lang" value={lang} />
              <FormAlert
                message={state.status === "error" ? (state.error === "invalid" ? t.forgot.invalid : t.forgot.error) : null}
              />
              <div className="space-y-2">
                <Label htmlFor="reset-email">{t.login.email}</Label>
                <Input
                  id="reset-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  dir="ltr"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.login.emailPlaceholder}
                  aria-invalid={state.error === "invalid" ? true : undefined}
                  className="h-11 text-base"
                />
              </div>
              <Button type="submit" disabled={pending} aria-busy={pending} className="h-11 w-full text-base">
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                )}
                {pending ? t.forgot.submitting : t.forgot.submit}
              </Button>
              <BackToLogin lang={lang} label={t.forgot.backToLogin} />
            </form>
          </AuthCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function BackToLogin({ lang, label }: { lang: Locale; label: string }) {
  return (
    <div className="flex justify-center">
      <Link
        href={`/${lang}/login`}
        className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {label}
      </Link>
    </div>
  );
}
