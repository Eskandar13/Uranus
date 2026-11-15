import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import "@/components/auth/auth.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Password pages frame: the auth shell + "auth"/"common" strings for the client forms. */
export default async function AuthLayout({ children, params }: LayoutProps<"/[lang]/auth">) {
  const { lang: raw } = await params;
  const lang = isLocale(raw) ? raw : "ar";
  const [auth, common] = await Promise.all([getDictionary(lang, "auth"), getDictionary(lang, "common")]);
  return (
    <I18nProvider lang={lang} messages={{ auth, common }}>
      <AuthShell lang={lang} t={auth}>
        {children}
      </AuthShell>
    </I18nProvider>
  );
}
