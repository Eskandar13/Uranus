"use client";

import { useCallback, useState } from "react";
import { Clock, Coins, Info, Palette, Phone } from "lucide-react";
import type { FontId, Restaurant } from "@/lib/data/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT, useUnsavedGuard } from "../hooks";
import { PageHeader } from "../ui";
import { BrandingForm } from "./branding-form";
import { ContactForm, CurrencyForm, HoursForm, InfoForm } from "./forms";
import { TimezoneField } from "./timezone-field";
import { SETTINGS_TABS, type SettingsTab } from "./tabs";


export interface FontOption {
  id: FontId;
  label: string;
  family: string;
}

const ICONS = { branding: Palette, info: Info, contact: Phone, hours: Clock, currency: Coins } as const;

/** Settings with one tab per section. Forms stay mounted so unsaved edits survive tab switches. */
export function SettingsView({
  restaurant,
  fonts,
  initialTab,
}: {
  restaurant: Restaurant;
  fonts: FontOption[];
  initialTab: SettingsTab;
}) {
  const t = useT();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const anyDirty = Object.values(dirty).some(Boolean);
  useUnsavedGuard(anyDirty, t.common.leaveConfirm);

  const report = useCallback((key: SettingsTab) => (d: boolean) => setDirty((s) => (s[key] === d ? s : { ...s, [key]: d })), []);
  const [reporters] = useState(() =>
    Object.fromEntries(SETTINGS_TABS.map((k) => [k, report(k)])) as Record<SettingsTab, (d: boolean) => void>,
  );

  const onTab = (value: string) => {
    const next = value as SettingsTab;
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  };

  return (
    <div>
      <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />
      <Tabs value={tab} onValueChange={onTab} className="gap-5">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-12 w-max gap-1 rounded-2xl bg-muted p-1 group-data-horizontal/tabs:h-12">
            {SETTINGS_TABS.map((key) => {
              const Icon = ICONS[key];
              return (
                <TabsTrigger key={key} value={key} className="h-10 min-w-24 gap-2 rounded-xl px-3.5 text-sm">
                  <Icon aria-hidden />
                  {t.settings.tabs[key]}
                  {dirty[key] && <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        <TabsContent value="branding" forceMount className="data-[state=inactive]:hidden">
          <BrandingForm restaurant={restaurant} fonts={fonts} onDirtyChange={reporters.branding} />
        </TabsContent>
        <TabsContent value="info" forceMount className="data-[state=inactive]:hidden">
          <InfoForm restaurant={restaurant} onDirtyChange={reporters.info} />
        </TabsContent>
        <TabsContent value="contact" forceMount className="data-[state=inactive]:hidden">
          <ContactForm restaurant={restaurant} onDirtyChange={reporters.contact} />
        </TabsContent>
        <TabsContent value="hours" forceMount className="data-[state=inactive]:hidden">
          <div className="space-y-4">
            <TimezoneField restaurant={restaurant} />
            <HoursForm restaurant={restaurant} onDirtyChange={reporters.hours} />
          </div>
        </TabsContent>
        <TabsContent value="currency" forceMount className="data-[state=inactive]:hidden">
          <CurrencyForm restaurant={restaurant} onDirtyChange={reporters.currency} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
