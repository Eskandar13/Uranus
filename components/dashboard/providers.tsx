"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/dictionaries";

/**
 * Providers for the owner dashboard: its own next-themes instance (storageKey "dash-theme",
 * light by default), tooltips, the common + dashboard dictionaries and Motion settings that
 * honour the user's reduced-motion preference.
 */
export function DashboardProviders({
  lang,
  messages,
  children,
}: {
  lang: Locale;
  messages: { common: Messages<"common">; dashboard: Messages<"dashboard"> };
  children: ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" storageKey="dash-theme" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <I18nProvider lang={lang} messages={messages}>
        <TooltipProvider delayDuration={300}>
          <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 420, damping: 34 }}>
            {children}
          </MotionConfig>
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
