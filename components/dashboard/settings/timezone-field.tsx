"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock } from "lucide-react";
import { COMMON_TIMEZONES, type Restaurant } from "@/lib/data/types";
import { saveTimezoneAction } from "@/lib/dashboard/actions";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { callAction, useFeedback, useT } from "../hooks";
import { SectionCard } from "../ui";

/** Restaurant time zone: makes "open now" on the public menu use the restaurant's clock. */
export function TimezoneField({ restaurant }: { restaurant: Restaurant }) {
  const t = useT();
  const th = t.settings.hours;
  const { lang } = useI18n();
  const feedback = useFeedback();
  const [saved, setSaved] = useState(restaurant.timezone);
  const [value, setValue] = useState(restaurant.timezone);
  const [pending, startTransition] = useTransition();
  const [clock, setClock] = useState<string | null>(null);

  const options = COMMON_TIMEZONES.includes(saved) ? COMMON_TIMEZONES : [saved, ...COMMON_TIMEZONES];

  // Current time in the selected zone (client only, refreshed every 30 s).
  useEffect(() => {
    const tick = () => {
      try {
        setClock(
          new Intl.DateTimeFormat(lang === "ar" ? "ar-u-nu-latn" : "en", {
            timeZone: value,
            weekday: "long",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date()),
        );
      } catch {
        setClock(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [value, lang]);

  const save = () =>
    startTransition(async () => {
      const res = await callAction(() => saveTimezoneAction(lang, restaurant.id, value));
      if (feedback(res, th.timezoneSaved)) setSaved(value);
    });

  return (
    <SectionCard title={th.timezone} description={th.timezoneHint}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="h-11 w-full rounded-xl sm:w-72" aria-label={th.timezone}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((tz) => (
              <SelectItem key={tz} value={tz}>
                <span dir="ltr">{tz.replace(/_/g, " ")}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {clock && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-4" aria-hidden />
            {th.nowThere} <span className="font-medium text-foreground">{clock}</span>
          </p>
        )}
        <Button className="h-11 rounded-xl sm:ms-auto" disabled={pending || value === saved} onClick={save}>
          {pending ? t.common.saving : th.timezoneSave}
        </Button>
      </div>
    </SectionCard>
  );
}
