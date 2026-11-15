"use client";

import { useId } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightLeft, CopyCheck, Eraser, Lock, Moon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/i18n/config";
import { CURRENCIES, DAY_KEYS, type DayKey, type Restaurant } from "@/lib/data/types";
import { formatAmount, formatPrice, getCurrency } from "@/lib/format/price";
import { saveContactAction, saveCurrencyAction, saveHoursAction, saveInfoAction } from "@/lib/dashboard/actions";
import { contactSchema, currencySchema, hoursSchema, infoSchema, type ContactInput, type InfoInput } from "@/lib/dashboard/schemas";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useT } from "../hooks";
import { Field, LocalizedFields, NumberField, SaveBar, SectionCard, StatusDot, inputClass, parseNumber } from "../ui";
import { useSettingsForm } from "./use-settings-form";

type DirtyProps = { restaurant: Restaurant; onDirtyChange: (dirty: boolean) => void };

/* ------------------------------------------------------------------ */
/* Info                                                                */
/* ------------------------------------------------------------------ */

export function InfoForm({ restaurant, onDirtyChange }: DirtyProps) {
  const t = useT();
  const { lang } = useI18n();
  const ti = t.settings.info;
  const { form, setForm, errors, dirty, saving, save, discard } = useSettingsForm<InfoInput, typeof infoSchema>({
    initial: { name: restaurant.name, tagline: restaurant.tagline, description: restaurant.description },
    schema: infoSchema,
    toInput: (f) => f,
    action: (input) => saveInfoAction(lang, restaurant.id, input),
    successMessage: ti.saved,
    onDirtyChange,
  });
  return (
    <div className="flex flex-col gap-5">
      <SectionCard title={ti.basics} bodyClassName="flex flex-col gap-5">
        <LocalizedFields label={ti.name} value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} errors={errors} errorKey="name" maxLength={80} />
        <LocalizedFields
          label={ti.tagline}
          value={form.tagline}
          onChange={(v) => setForm((f) => ({ ...f, tagline: v }))}
          errors={errors}
          errorKey="tagline"
          maxLength={140}
          optional
          placeholder={{ en: ti.taglinePlaceholder }}
        />
        <LocalizedFields
          label={ti.description}
          value={form.description}
          onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          errors={errors}
          errorKey="description"
          multiline
          maxLength={800}
          optional
          placeholder={{ en: ti.descriptionPlaceholder }}
        />
      </SectionCard>

      <SectionCard
        title={ti.account}
        description={t.common.contactAgency}
        action={
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            {t.common.readOnly}
          </span>
        }
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <ReadOnly label={ti.slug} value={<span dir="ltr">/{restaurant.slug}</span>} />
          <ReadOnly label={ti.customDomain} value={restaurant.customDomain ? <span dir="ltr">{restaurant.customDomain}</span> : ti.noDomain} />
          <ReadOnly label={ti.plan} value={t.status.plans[restaurant.plan]} />
          <ReadOnly
            label={ti.status}
            value={<StatusDot active={restaurant.isActive} label={restaurant.isActive ? t.status.active : t.status.inactive} />}
          />
        </dl>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Contact                                                             */
/* ------------------------------------------------------------------ */

type ContactForm = { [K in keyof ContactInput]: K extends "address" ? ContactInput["address"] : string };

export function ContactForm({ restaurant, onDirtyChange }: DirtyProps) {
  const t = useT();
  const { lang } = useI18n();
  const tc = t.settings.contact;
  const c = restaurant.contact;
  const { form, setForm, errors, dirty, saving, save, discard } = useSettingsForm<ContactForm, typeof contactSchema>({
    initial: {
      whatsapp: c.whatsapp ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? { ar: "", en: "" },
      mapsUrl: c.mapsUrl ?? "",
      instagram: c.instagram ?? "",
      facebook: c.facebook ?? "",
      tiktok: c.tiktok ?? "",
      website: c.website ?? "",
    },
    schema: contactSchema,
    toInput: (f) => f,
    action: (input) => saveContactAction(lang, restaurant.id, input),
    successMessage: tc.saved,
    onDirtyChange,
  });
  const text = (key: Exclude<keyof ContactForm, "address">, opts: { type?: string; inputMode?: "tel" | "email" | "url" | "numeric"; placeholder?: string; hint?: string }) => {
    const id = `contact-${key}`;
    return (
      <Field label={tc[key]} htmlFor={id} error={errors[key]} hint={opts.hint} optional>
        <Input
          id={id}
          dir="ltr"
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          autoComplete="off"
          value={form[key]}
          placeholder={opts.placeholder}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          aria-invalid={Boolean(errors[key]) || undefined}
          aria-describedby={errors[key] ? `${id}-error` : undefined}
          className={cn(inputClass, "text-start")}
        />
      </Field>
    );
  };
  return (
    <div className="flex flex-col gap-5">
      <SectionCard title={tc.reach} bodyClassName="grid gap-5 sm:grid-cols-2">
        {text("whatsapp", { inputMode: "tel", placeholder: "963912345678", hint: tc.whatsappHint })}
        {text("phone", { type: "tel", inputMode: "tel", placeholder: "+963 11 123 4567" })}
        {text("email", { type: "email", inputMode: "email", placeholder: "hello@example.com" })}
        {text("mapsUrl", { inputMode: "url", placeholder: "https://maps.app.goo.gl/…" })}
        <div className="sm:col-span-2">
          <LocalizedFields
            label={tc.address}
            value={form.address}
            onChange={(v) => setForm((f) => ({ ...f, address: v }))}
            errors={errors}
            errorKey="address"
            maxLength={240}
            optional
          />
        </div>
      </SectionCard>
      <SectionCard title={tc.social} bodyClassName="grid gap-5 sm:grid-cols-2">
        {text("instagram", { inputMode: "url", placeholder: "https://instagram.com/…" })}
        {text("facebook", { inputMode: "url", placeholder: "https://facebook.com/…" })}
        {text("tiktok", { inputMode: "url", placeholder: "https://tiktok.com/@…" })}
        {text("website", { inputMode: "url", placeholder: "https://…" })}
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Opening hours                                                       */
/* ------------------------------------------------------------------ */

interface DayRow {
  open: string;
  close: string;
  isOpen: boolean;
}
type HoursForm = Record<DayKey, DayRow>;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map((n) => Number.parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
};

export function HoursForm({ restaurant, onDirtyChange }: DirtyProps) {
  const t = useT();
  const { lang } = useI18n();
  const th = t.settings.hours;
  const initial = Object.fromEntries(
    DAY_KEYS.map((d) => {
      const h = restaurant.openingHours?.[d];
      return [d, { open: h?.open || "09:00", close: h?.close || "23:00", isOpen: Boolean(h && !h.closed) }];
    }),
  ) as HoursForm;
  const { form, setForm, errors, dirty, saving, save, discard } = useSettingsForm<HoursForm, typeof hoursSchema>({
    initial,
    schema: hoursSchema,
    // No open day at all = no hours (the menu then hides the open/closed badge).
    toInput: (f) =>
      DAY_KEYS.some((d) => f[d].isOpen)
        ? Object.fromEntries(
            DAY_KEYS.map((d) => [d, f[d].isOpen ? { open: f[d].open, close: f[d].close } : { open: f[d].open, close: f[d].close, closed: true }]),
          )
        : {},
    action: (input) => saveHoursAction(lang, restaurant.id, input),
    successMessage: th.saved,
    onDirtyChange,
  });
  const setDay = (d: DayKey, patch: Partial<DayRow>) => setForm((f) => ({ ...f, [d]: { ...f[d], ...patch } }));
  const copyToAll = (d: DayKey) => {
    setForm((f) => Object.fromEntries(DAY_KEYS.map((k) => [k, { ...f[d] }])) as HoursForm);
    toast.success(th.copied);
  };
  const noneOpen = !DAY_KEYS.some((d) => form[d].isOpen);

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title={th.title}
        description={th.hint}
        action={
          <Button
            type="button"
            variant="ghost"
            className="h-10 shrink-0 rounded-xl text-muted-foreground"
            onClick={() => setForm((f) => Object.fromEntries(DAY_KEYS.map((k) => [k, { ...f[k], isOpen: false }])) as HoursForm)}
            disabled={noneOpen}
          >
            <Eraser aria-hidden />
            <span className="max-sm:sr-only">{th.clear}</span>
          </Button>
        }
      >
        {noneOpen && <p className="mb-3 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">{th.notSet}</p>}
        <ul className="flex flex-col divide-y">
          {DAY_KEYS.map((d) => {
            const row = form[d];
            const day = t.days[d];
            const overnight = row.isOpen && toMinutes(row.close) < toMinutes(row.open);
            const allDay = row.isOpen && row.open === row.close;
            const err = errors[`${d}.open`] ?? errors[`${d}.close`];
            return (
              <li key={d} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                <label className="flex min-h-11 min-w-40 cursor-pointer items-center gap-3">
                  <Switch checked={row.isOpen} onCheckedChange={(v) => setDay(d, { isOpen: v })} aria-label={fmt(th.openDay, { day })} />
                  <span className={cn("text-sm font-semibold", !row.isOpen && "text-muted-foreground")}>{day}</span>
                </label>
                <AnimatePresence initial={false} mode="wait">
                  {row.isOpen ? (
                    <motion.div
                      key="open"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-1 flex-wrap items-center gap-2"
                    >
                      <TimeInput label={`${th.open} — ${day}`} value={row.open} onChange={(v) => setDay(d, { open: v })} invalid={Boolean(err)} />
                      <span className="text-muted-foreground" aria-hidden>
                        –
                      </span>
                      <TimeInput label={`${th.close} — ${day}`} value={row.close} onChange={(v) => setDay(d, { close: v })} invalid={Boolean(err)} />
                      {overnight && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/12 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                          <Moon className="size-3" aria-hidden />
                          {th.afterMidnight}
                        </span>
                      )}
                      {allDay && <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">{th.allDay}</span>}
                      <Button type="button" variant="ghost" className="h-10 rounded-xl px-2.5 text-xs text-muted-foreground sm:ms-auto" onClick={() => copyToAll(d)}>
                        <CopyCheck aria-hidden />
                        {th.copyToAll}
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.span key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-muted-foreground">
                      {th.closed}
                    </motion.span>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}

function TimeInput({ label, value, onChange, invalid }: { label: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <Input
      type="time"
      dir="ltr"
      step={300}
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, 5))}
      aria-label={label}
      aria-invalid={invalid || undefined}
      className="h-11 w-32 rounded-xl text-base tabular-nums lg:h-10 lg:text-sm"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Currency                                                            */
/* ------------------------------------------------------------------ */

interface CurrencyForm {
  currency: string;
  secondaryCurrency: string | null;
  exchangeRate: string;
}

const NONE = "__none__";

export function CurrencyForm({ restaurant, onDirtyChange }: DirtyProps) {
  const t = useT();
  const { lang } = useI18n();
  const tc = t.settings.currency;
  const mainId = useId();
  const secId = useId();
  const rateId = useId();
  const { form, setForm, errors, dirty, saving, save, discard } = useSettingsForm<CurrencyForm, typeof currencySchema>({
    initial: {
      currency: restaurant.currency,
      secondaryCurrency: restaurant.secondaryCurrency,
      exchangeRate: restaurant.exchangeRate ? String(restaurant.exchangeRate) : "",
    },
    schema: currencySchema,
    toInput: (f) => ({
      currency: f.currency,
      secondaryCurrency: f.secondaryCurrency,
      exchangeRate: f.secondaryCurrency ? (parseNumber(f.exchangeRate) ?? Number.NaN) : null,
    }),
    action: (input) => saveCurrencyAction(lang, restaurant.id, input),
    successMessage: tc.saved,
    onDirtyChange,
  });
  const label = (code: string) => {
    const c = getCurrency(code);
    return `${code} · ${c.symbol[lang]}`;
  };
  const rate = parseNumber(form.exchangeRate);
  const exampleAmount = getCurrency(form.currency).decimals === 0 ? 10000 : 1;

  return (
    <div className="flex flex-col gap-5">
      <SectionCard title={tc.title} bodyClassName="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={tc.main} htmlFor={mainId} hint={tc.mainHint} error={errors.currency}>
            <Select
              value={form.currency}
              onValueChange={(v) => setForm((f) => ({ ...f, currency: v, secondaryCurrency: f.secondaryCurrency === v ? null : f.secondaryCurrency }))}
            >
              <SelectTrigger id={mainId} className="h-11 w-full rounded-xl data-[size=default]:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="min-h-10">
                    {label(c.code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={tc.secondary} htmlFor={secId} hint={tc.secondaryHint} error={errors.secondaryCurrency} optional>
            <Select
              value={form.secondaryCurrency ?? NONE}
              onValueChange={(v) => setForm((f) => ({ ...f, secondaryCurrency: v === NONE ? null : v }))}
            >
              <SelectTrigger id={secId} className="h-11 w-full rounded-xl data-[size=default]:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={NONE} className="min-h-10">
                  {t.common.none}
                </SelectItem>
                {CURRENCIES.filter((c) => c.code !== form.currency).map((c) => (
                  <SelectItem key={c.code} value={c.code} className="min-h-10">
                    {label(c.code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <AnimatePresence initial={false}>
          {form.secondaryCurrency && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label={tc.rate}
                  htmlFor={rateId}
                  hint={fmt(tc.rateHint, { from: form.currency, to: form.secondaryCurrency })}
                  error={errors.exchangeRate}
                >
                  <NumberField
                    id={rateId}
                    value={form.exchangeRate}
                    onChange={(v) => setForm((f) => ({ ...f, exchangeRate: v }))}
                    suffix={form.secondaryCurrency}
                    invalid={Boolean(errors.exchangeRate)}
                    placeholder="122"
                  />
                </Field>
                <div className="flex flex-col justify-center gap-1.5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-rose-500/10 p-4">
                  <span className="text-xs font-medium text-muted-foreground">{tc.example}</span>
                  <p className="flex flex-wrap items-center gap-2 text-lg font-bold tabular-nums" dir="ltr">
                    <span>1 {form.currency}</span>
                    <ArrowRightLeft className="size-4 text-muted-foreground" aria-hidden />
                    <span>
                      {rate && rate > 0 ? formatAmount(rate, form.secondaryCurrency, "en") : "—"} {form.secondaryCurrency}
                    </span>
                  </p>
                  {rate && rate > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {fmt(tc.exampleLine, {
                        a: formatPrice(exampleAmount, form.currency, lang),
                        b: formatPrice(exampleAmount * rate, form.secondaryCurrency, lang),
                      })}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="mt-4 rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">{tc.guestsSwitch}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
