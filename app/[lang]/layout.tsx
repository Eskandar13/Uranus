import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { fontVariables } from "@/lib/fonts";
import { dirOf, isLocale, locales } from "@/lib/i18n/config";
import { PLATFORM_NAME } from "@/lib/env";
import "../globals.css";

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const metadata: Metadata = {
  title: { default: PLATFORM_NAME, template: `%s · ${PLATFORM_NAME}` },
  description: "Digital QR menus for restaurants and cafés",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
  ],
};

/**
 * Root layout for every page. The language is the first URL segment (/ar, /en) and sets
 * <html lang dir>. Areas (menu, dashboard, admin, landing) add their own providers in their
 * own layouts (I18nProvider, ThemeProvider from next-themes with their own storageKey, etc.).
 */
export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html lang={lang} dir={dirOf(lang)} className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        {children}
        <Toaster position={lang === "ar" ? "top-left" : "top-right"} richColors closeButton />
      </body>
    </html>
  );
}
