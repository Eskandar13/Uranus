import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";
import "@/components/auth/auth.css";

export async function generateMetadata({ params }: LayoutProps<"/[lang]/login">): Promise<Metadata> {
  const { lang: raw } = await params;
  const t = await getDictionary(isLocale(raw) ? raw : "ar", "auth");
  return { title: t.login.metaTitle, robots: { index: false, follow: false } };
}

/** Login frame: the auth shell + "auth"/"common" strings for the client forms. */
export default async function LoginLayout({ children, params }: LayoutProps<"/[lang]/login">) {
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
