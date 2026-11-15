import type { Metadata } from "next";
import { Info } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { BackToLogin, ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getDataMode } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/auth/forgot-password">): Promise<Metadata> {
  const { lang: raw } = await params;
  const t = await getDictionary(isLocale(raw) ? raw : "ar", "auth");
  return { title: t.forgot.metaTitle };
}

/** /[lang]/auth/forgot-password: email form (Supabase) or an explanation (local demo mode). */
export default async function ForgotPasswordPage({ params }: PageProps<"/[lang]/auth/forgot-password">) {
  const { lang: raw } = await params;
  const lang = isLocale(raw) ? raw : "ar";

  if (getDataMode() === "local") {
    const t = await getDictionary(lang, "auth");
    return (
      <AuthCard
        title={t.forgot.localTitle}
        subtitle={t.forgot.localBody}
        icon={<Info className="size-6 text-amber-600" aria-hidden="true" />}
      >
        <BackToLogin lang={lang} label={t.forgot.backToLogin} />
      </AuthCard>
    );
  }
  return <ForgotPasswordForm lang={lang} />;
}
