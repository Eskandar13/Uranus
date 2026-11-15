"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useMessages } from "@/components/providers/i18n-provider";
import { updatePasswordAction } from "@/lib/auth/actions";
import { fmt, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { AuthCard, FormAlert } from "./auth-card";
import { PasswordInput } from "./password-input";
import type { UpdatePasswordFormState } from "./types";

export function UpdatePasswordForm({ lang, email }: { lang: Locale; email: string }) {
  const t = useMessages("auth");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<UpdatePasswordFormState, FormData>(updatePasswordAction, {});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      toast.success(t.update.success);
      router.replace(state.redirectTo);
    }
  }, [state, router, t.update.success]);

  const longEnough = password.length >= 8;
  const matches = confirm.length > 0 && confirm === password;

  return (
    <AuthCard
      title={t.update.title}
      subtitle={
        <>
          {t.update.subtitle}
          {email ? (
            <span className="mt-1 block text-foreground/80" dir="auto">
              {fmt(t.update.signedInAs, { email })}
            </span>
          ) : null}
        </>
      }
      icon={<ShieldCheck className="size-6" aria-hidden="true" />}
    >
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="lang" value={lang} />
        {/* Helps password managers save the new password for the right account. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <FormAlert message={state.error ? t.update.errors[state.error] : null} />

        <div className="space-y-2">
          <Label htmlFor="new-password">{t.update.password}</Label>
          <PasswordInput
            id="new-password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            showLabel={t.login.showPassword}
            hideLabel={t.login.hidePassword}
            aria-describedby="new-password-hint"
            aria-invalid={state.error === "too_short" || state.error === "weak_password" ? true : undefined}
          />
          <Requirement id="new-password-hint" met={longEnough} label={t.update.hint} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">{t.update.confirm}</Label>
          <PasswordInput
            id="confirm-password"
            name="confirm"
            autoComplete="new-password"
            required
            maxLength={128}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            showLabel={t.login.showPassword}
            hideLabel={t.login.hidePassword}
            aria-invalid={state.error === "mismatch" || (confirm.length > 0 && !matches) ? true : undefined}
          />
        </div>

        <Button type="submit" disabled={pending || state.ok} aria-busy={pending} className="h-11 w-full text-base">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? t.update.submitting : t.update.submit}
        </Button>
      </form>
    </AuthCard>
  );
}

function Requirement({ id, met, label }: { id: string; met: boolean; label: string }) {
  return (
    <p id={id} className={cn("flex items-center gap-1.5 text-xs transition-colors", met ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
      <span
        className={cn(
          "inline-flex size-4 items-center justify-center rounded-full border transition-all duration-200",
          met ? "scale-100 border-emerald-600 bg-emerald-600 text-white" : "scale-90 border-muted-foreground/40",
        )}
        aria-hidden="true"
      >
        {met ? <Check className="size-3" /> : null}
      </span>
      {label}
    </p>
  );
}
