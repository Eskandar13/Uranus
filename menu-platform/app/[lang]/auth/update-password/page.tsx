import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthCardSkeleton } from "@/components/auth/auth-skeleton";
import { HashSessionBridge } from "@/components/auth/hash-session-bridge";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getDataMode } from "@/lib/env";
import { getDictionary, type Messages } from "@/lib/i18n/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/auth/update-password">): Promise<Metadata> {
  const { lang: raw } = await params;
  const t = await getDictionary(isLocale(raw) ? raw : "ar", "auth");
  return { title: t.update.metaTitle };
}

/**
 * /[lang]/auth/update-password: set a new password. Supabase: reached from the invite/recovery
 * email through /auth/callback (which created the session). Local: any signed-in user.
 */
export default function UpdatePasswordPage({ params }: PageProps<"/[lang]/auth/update-password">) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <UpdatePasswordGate params={params} />
    </Suspense>
  );
}

async function UpdatePasswordGate({ params }: { params: PageProps<"/[lang]/auth/update-password">["params"] }) {
  const { lang: raw } = await params;
  const lang = isLocale(raw) ? raw : "ar";
  const [user, t] = await Promise.all([getCurrentUser(), getDictionary(lang, "auth")]);
  if (user) return <UpdatePasswordForm lang={lang} email={user.email} />;

  const local = getDataMode() === "local";
  const expired = <NoSession lang={lang} local={local} t={t} />;
  return local ? expired : <HashSessionBridge loadingLabel={t.update.submitting}>{expired}</HashSessionBridge>;
}

function NoSession({
  lang,
  local,
  t,
}: {
  lang: Locale;
  local: boolean;
  t: Messages<"auth">;
}) {
  return (
    <AuthCard
      title={local ? t.update.title : t.update.noSessionTitle}
      subtitle={local ? t.update.localNoSession : t.update.noSession}
      icon={<Clock className="size-6 text-amber-600" aria-hidden="true" />}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="h-11 flex-1">
          <Link href={`/${lang}/login?next=${encodeURIComponent(`/${lang}/dashboard`)}`}>{t.update.goLogin}</Link>
        </Button>
        {local ? null : (
          <Button asChild variant="outline" className="h-11 flex-1">
            <Link href={`/${lang}/auth/forgot-password`}>{t.update.requestNew}</Link>
          </Button>
        )}
      </div>
    </AuthCard>
  );
}
