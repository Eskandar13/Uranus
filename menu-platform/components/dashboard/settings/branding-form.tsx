"use client";

import { useId, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { pick } from "@/lib/i18n/config";
import { TEMPLATE_IDS, type ColorMode, type RadiusId, type Restaurant, type RestaurantTheme, type TemplateId } from "@/lib/data/types";
import { formatPrice } from "@/lib/format/price";
import { brandVars, parseHex } from "@/lib/menu/color";
import { saveBrandingAction } from "@/lib/dashboard/actions";
import { brandingSchema, type BrandingInput } from "@/lib/dashboard/schemas";
import { useI18n } from "@/components/providers/i18n-provider";
import { Input } from "@/components/ui/input";
import { useT } from "../hooks";
import { ImageUploader } from "../image-uploader";
import { Field, SaveBar, SectionCard } from "../ui";
import type { FontOption } from "./settings-view";
import { useSettingsForm } from "./use-settings-form";

const PRESETS = ["#C2410C", "#B91C1C", "#BE185D", "#7C3AED", "#1D4ED8", "#0E7490", "#0F766E", "#15803D", "#A16207", "#1F2937"];
const RADIUS_PX: Record<RadiusId, string> = { sharp: "6px", soft: "14px", round: "22px" };

export function BrandingForm({
  restaurant,
  fonts,
  onDirtyChange,
}: {
  restaurant: Restaurant;
  fonts: FontOption[];
  onDirtyChange: (dirty: boolean) => void;
}) {
  const t = useT();
  const { lang } = useI18n();
  const tb = t.settings.branding;
  const [logoBusy, setLogoBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const uploading = logoBusy || coverBusy;
  const { form, setForm, errors, dirty, saving, save: saveForm, discard } = useSettingsForm<BrandingInput, typeof brandingSchema>({
    initial: {
      logoUrl: restaurant.logoUrl,
      coverUrl: restaurant.coverUrl,
      coverBlur: restaurant.coverBlur,
      theme: { ...restaurant.theme },
    },
    schema: brandingSchema,
    toInput: (f) => f,
    action: (input) => saveBrandingAction(lang, restaurant.id, input),
    successMessage: tb.saved,
    onDirtyChange,
  });
  const save = () => {
    if (!uploading) saveForm();
  };
  const setTheme = <K extends keyof RestaurantTheme>(key: K, value: RestaurantTheme[K]) =>
    setForm((f) => ({ ...f, theme: { ...f.theme, [key]: value } }));
  const fontFamily = fonts.find((f) => f.id === form.theme.font)?.family;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem] xl:gap-6">
      <div className="flex min-w-0 flex-col gap-5">
        <SectionCard title={tb.images} bodyClassName="grid gap-5 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <Field label={tb.logo}>
            <ImageUploader
              restaurantId={restaurant.id}
              kind="logo"
              aspect="square"
              label={tb.logo}
              value={{ url: form.logoUrl, blur: null }}
              onChange={(v) => setForm((f) => ({ ...f, logoUrl: v.url }))}
              onBusyChange={setLogoBusy}
            />
          </Field>
          <Field label={tb.cover}>
            <ImageUploader
              restaurantId={restaurant.id}
              kind="cover"
              aspect="wide"
              label={tb.cover}
              hint={tb.coverHint}
              value={{ url: form.coverUrl, blur: form.coverBlur }}
              onChange={(v) => setForm((f) => ({ ...f, coverUrl: v.url, coverBlur: v.blur }))}
              onBusyChange={setCoverBusy}
            />
          </Field>
        </SectionCard>

        <SectionCard title={tb.template}>
          <div role="radiogroup" aria-label={tb.template} className="grid grid-cols-3 gap-2 sm:gap-3">
            {TEMPLATE_IDS.map((id) => (
              <TemplateCard
                key={id}
                id={id}
                selected={form.theme.template === id}
                primary={form.theme.primary}
                accent={form.theme.accent}
                label={tb.templates[id]}
                hint={tb.templateHints[id]}
                onSelect={() => setTheme("template", id)}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title={tb.colors} bodyClassName="grid gap-5 sm:grid-cols-2">
          <ColorField label={tb.primary} value={form.theme.primary} onChange={(v) => setTheme("primary", v)} error={errors["theme.primary"]} />
          <ColorField label={tb.accent} value={form.theme.accent} onChange={(v) => setTheme("accent", v)} error={errors["theme.accent"]} />
        </SectionCard>

        <SectionCard title={tb.font}>
          <div role="radiogroup" aria-label={tb.font} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {fonts.map((f) => {
              const selected = form.theme.font === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme("font", f.id)}
                  className={cn(
                    "relative flex min-h-20 flex-col items-start justify-center gap-1 rounded-xl border p-3 text-start outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected ? "border-primary ring-1 ring-primary" : "hover:border-foreground/30",
                  )}
                >
                  <span className="text-xl leading-tight" style={{ fontFamily: f.family }}>
                    أهلاً Aa
                  </span>
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  {selected && <Check className="absolute end-2 top-2 size-4" aria-hidden />}
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard bodyClassName="grid gap-5 sm:grid-cols-2">
          <Segmented<ColorMode>
            label={tb.mode}
            value={form.theme.mode}
            onChange={(v) => setTheme("mode", v)}
            options={[
              { value: "light", label: tb.modes.light, icon: Sun },
              { value: "dark", label: tb.modes.dark, icon: Moon },
              { value: "system", label: tb.modes.system, icon: Monitor },
            ]}
          />
          <Segmented<RadiusId>
            label={tb.radius}
            value={form.theme.radius}
            onChange={(v) => setTheme("radius", v)}
            options={(["sharp", "soft", "round"] as const).map((r) => ({
              value: r,
              label: tb.radii[r],
              render: <span className="size-4 border-2 border-current" style={{ borderRadius: r === "sharp" ? 1 : r === "soft" ? 4 : 8 }} aria-hidden />,
            }))}
          />
        </SectionCard>
      </div>

      <aside className="flex flex-col gap-2 xl:sticky xl:top-8 max-xl:mx-auto max-xl:w-full max-xl:max-w-sm">
        <h2 className="text-sm font-semibold">{tb.preview}</h2>
        <BrandPreview restaurant={restaurant} form={form} fontFamily={fontFamily} />
      </aside>

      <div className="xl:col-span-2">
        <SaveBar dirty={dirty} saving={saving || uploading} onSave={save} onDiscard={discard} />
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const t = useT();
  const id = useId();
  const valid = Boolean(parseHex(value)) && /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <Field label={label} htmlFor={`${id}-hex`} error={error}>
      <div className="flex items-center gap-2">
        <label className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border shadow-xs" style={{ background: valid ? value : "transparent" }}>
          <span className="sr-only">{label}</span>
          <input
            type="color"
            value={valid ? value.toLowerCase() : "#000000"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          id={`${id}-hex`}
          dir="ltr"
          value={value}
          maxLength={7}
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && !v.startsWith("#")) v = `#${v}`;
            onChange(v.toUpperCase());
          }}
          aria-invalid={!valid || undefined}
          className="h-11 max-w-36 rounded-xl font-mono text-base uppercase lg:h-10 lg:text-sm"
        />
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label={`${label} — ${t.settings.branding.presets}`}>
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-label={p}
            aria-pressed={value.toUpperCase() === p}
            className={cn(
              "size-8 rounded-full border-2 outline-none transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50",
              value.toUpperCase() === p ? "border-foreground" : "border-background shadow-[0_0_0_1px_var(--border)]",
            )}
            style={{ background: p }}
          />
        ))}
      </div>
    </Field>
  );
}

function Segmented<V extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: Array<{ value: V; label: string; icon?: typeof Sun; render?: React.ReactNode }>;
}) {
  const groupId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={groupId} className="text-[0.82rem] font-medium">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={groupId} className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {options.map((o) => {
          const selected = o.value === value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.value)}
              className={cn(
                "relative flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm",
                selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {selected && <motion.span layoutId={`seg-${groupId}`} className="absolute inset-0 rounded-lg bg-background shadow-sm" aria-hidden />}
              <span className="relative flex items-center gap-1.5">
                {Icon ? <Icon className="size-4" aria-hidden /> : o.render}
                {o.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TemplateCard({
  id,
  selected,
  primary,
  accent,
  label,
  hint,
  onSelect,
}: {
  id: TemplateId;
  selected: boolean;
  primary: string;
  accent: string;
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  const dark = id === "noir";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col gap-2 rounded-2xl border p-2 text-start outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "border-primary ring-2 ring-primary/70" : "hover:border-foreground/30",
      )}
    >
      <span
        className="relative block aspect-[3/4] w-full overflow-hidden rounded-xl"
        style={{ background: dark ? "#111113" : id === "pop" ? `color-mix(in oklab, ${accent} 18%, #fff)` : "#fafaf9" }}
        aria-hidden
      >
        {id === "aurora" && (
          <>
            <span className="absolute inset-x-0 top-0 h-[38%]" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }} />
            <span className="absolute start-[12%] top-[28%] size-[22%] rounded-full border-2 border-white bg-white shadow" />
            <span className="absolute inset-x-[12%] top-[56%] h-[7%] rounded-full bg-black/10" />
            <span className="absolute start-[12%] top-[68%] h-[22%] w-[35%] rounded-lg bg-white shadow" />
            <span className="absolute end-[12%] top-[68%] h-[22%] w-[35%] rounded-lg bg-white shadow" />
          </>
        )}
        {id === "noir" && (
          <>
            <span className="absolute inset-x-[12%] top-[14%] h-[6%] rounded-sm" style={{ background: accent }} />
            <span className="absolute inset-x-[12%] top-[26%] h-[10%] rounded-sm bg-white/85" />
            {[44, 58, 72].map((y) => (
              <span key={y} className="absolute inset-x-[12%] flex items-center gap-[4%]" style={{ top: `${y}%` }}>
                <span className="h-[3px] w-[40%] bg-white/60" />
                <span className="h-px flex-1 border-t border-dotted border-white/30" />
                <span className="h-[3px] w-[14%]" style={{ background: primary }} />
              </span>
            ))}
          </>
        )}
        {id === "pop" && (
          <>
            <span className="absolute start-[10%] top-[10%] h-[14%] w-[55%] -rotate-3 rounded-md" style={{ background: primary }} />
            <span className="absolute end-[10%] top-[12%] size-[18%] rotate-12 rounded-full" style={{ background: accent }} />
            <span className="absolute start-[10%] top-[34%] h-[26%] w-[80%] rounded-xl border-2 border-black bg-white shadow-[3px_3px_0_#000]" />
            <span className="absolute start-[10%] top-[66%] h-[24%] w-[80%] rounded-xl border-2 border-black bg-white shadow-[3px_3px_0_#000]" />
          </>
        )}
      </span>
      <span className="px-1">
        <span className="flex items-center gap-1 text-sm font-semibold">
          {label}
          {selected && <Check className="size-4" aria-hidden />}
        </span>
        <span className="line-clamp-2 text-[0.7rem] leading-snug text-muted-foreground max-sm:hidden">{hint}</span>
      </span>
    </button>
  );
}

/** Mini phone preview of the public menu header and one dish, using the chosen brand. */
function BrandPreview({ restaurant, form, fontFamily }: { restaurant: Restaurant; form: BrandingInput; fontFamily?: string }) {
  const t = useT();
  const { lang } = useI18n();
  const tb = t.settings.branding;
  const { theme } = form;
  const dark = theme.template === "noir" || theme.mode === "dark";
  const vars = brandVars(theme.primary, theme.accent);
  const style = {
    ...vars,
    fontFamily,
    "--r": RADIUS_PX[theme.radius],
    background: dark ? "#141414" : theme.template === "pop" ? `color-mix(in oklab, ${theme.accent} 10%, #fff)` : "#fafaf9",
    color: dark ? "#f5f5f5" : "#171717",
  } as CSSProperties;
  const ink = dark ? vars["--brand-ink-dark"] : vars["--brand-ink-light"];
  const name = pick(restaurant.name, lang);
  return (
    <motion.div layout style={style} className="overflow-hidden rounded-[1.75rem] border-[6px] border-foreground/85 shadow-xl" aria-label={tb.preview} role="img">
      <div className="relative h-28">
        {form.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>
      <div className="relative px-4">
        <div className="flex items-start gap-3">
          <span className="relative -mt-8 grid size-16 shrink-0 place-items-center overflow-hidden rounded-(--r) border-4 bg-white shadow-md" style={{ borderColor: dark ? "#141414" : "#fff" }}>
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="" className="size-full object-contain" />
            ) : (
              <span className="text-2xl font-bold" style={{ color: theme.primary }}>
                {Array.from(name)[0] ?? "؟"}
              </span>
            )}
          </span>
          <div className="min-w-0 pt-2">
            <p className="truncate text-base font-extrabold">{name}</p>
            <p className="truncate text-xs opacity-60">{pick(restaurant.tagline, lang) || tb.previewTagline}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-1.5">
          <span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: "var(--brand)", color: "var(--brand-contrast)" }}>
            {tb.previewCategory}
          </span>
          <span className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: dark ? "#262626" : "#ececec" }}>
            ☕
          </span>
          <span className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: dark ? "#262626" : "#ececec" }}>
            🍰
          </span>
        </div>
        <div
          className={cn(
            "my-4 flex items-center gap-3 rounded-(--r) p-2.5",
            theme.template === "pop" ? "border-2 border-black bg-white text-neutral-900 shadow-[3px_3px_0_#000]" : dark ? "bg-white/[0.06]" : "bg-white shadow-sm",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{tb.previewDish}</span>
            <span className="mt-1 flex items-baseline gap-1.5 text-sm font-bold" style={{ color: theme.template === "pop" ? vars["--brand-ink-light"] : ink }}>
              {formatPrice(4.5, restaurant.currency, lang)}
              <s className="text-[0.7rem] font-medium opacity-50">{formatPrice(5.5, restaurant.currency, lang)}</s>
            </span>
          </span>
          <span className="relative size-14 shrink-0 overflow-hidden rounded-[calc(var(--r)*0.7)]" style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.primary})` }}>
            <span
              className="absolute end-1 top-1 rounded-full px-1.5 text-[0.6rem] font-extrabold"
              style={{ background: "var(--brand-accent)", color: "var(--brand-accent-contrast)" }}
            >
              -18%
            </span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
