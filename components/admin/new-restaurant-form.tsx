"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, ExternalLink, Loader2, Mail, PencilLine, Plus, Settings2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert } from "@/components/auth/auth-card";
import { useI18n, useMessages } from "@/components/providers/i18n-provider";
import { createRestaurantAction } from "@/app/[lang]/admin/actions";
import { slugify } from "@/lib/data/slug";
import { CURRENCIES, type TemplateId } from "@/lib/data/types";
import { fmt, pick } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { useEditMenu } from "./restaurant-dialogs";
import { SectionCard, TempPasswordCard, useAdminErrorMessage } from "./shared";
import { SlugField, useSlugStatus } from "./slug-field";
import { TemplatePicker } from "./template-picker";
import { BRAND_PRESETS, type CreateRestaurantState } from "./types";

/** "New restaurant" flow. "Create another" remounts the inner form with a fresh action state. */
export function NewRestaurantForm({ mode, menuUrlPattern }: { mode: "local" | "supabase"; menuUrlPattern: string }) {
  const [round, setRound] = useState(0);
  return <NewRestaurantFormInner key={round} mode={mode} menuUrlPattern={menuUrlPattern} onAnother={() => setRound((n) => n + 1)} />;
}

function NewRestaurantFormInner({
  mode,
  menuUrlPattern,
  onAnother,
}: {
  mode: "local" | "supabase";
  menuUrlPattern: string;
  onAnother: () => void;
}) {
  const { lang } = useI18n();
  const t = useMessages("admin");
  const reduce = useReducedMotion();
  const errorMessage = useAdminErrorMessage();
  const [state, formAction, pending] = useActionState<CreateRestaurantState, FormData>(createRestaurantAction, {});

  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [template, setTemplate] = useState<TemplateId>("aurora");
  const [primary, setPrimary] = useState<string>(BRAND_PRESETS[0]);
  const [currency, setCurrency] = useState("USD");
  const [ownerEmail, setOwnerEmail] = useState("");

  const slugStatus = useSlugStatus(lang, slug);
  const blocked = slugStatus === "taken" || slugStatus === "invalid" || slugStatus === "reserved" || (!nameAr.trim() && !nameEn.trim());

  function onNameEn(v: string) {
    setNameEn(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  if (state.ok && state.created) {
    return <CreatedPanel state={state} onAnother={onAnother} />;
  }

  const fieldError = (f: string) => (state.field === f && state.error ? errorMessage(state.error) : null);
  const generalError = state.error && !state.field ? errorMessage(state.error) : state.error === "invalid" ? errorMessage("invalid") : null;

  return (
    <motion.form
      action={formAction}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      noValidate={false}
    >
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="template" value={template} />
      <input type="hidden" name="primary" value={primary} />
      <input type="hidden" name="currency" value={currency} />

      <FormAlert message={generalError} />

      <SectionCard title={t.new.basics} id="sec-basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-name-ar">{t.form.nameAr}</Label>
            <Input
              id="new-name-ar"
              name="nameAr"
              dir="rtl"
              lang="ar"
              maxLength={80}
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder={t.form.nameArPlaceholder}
              aria-invalid={state.field === "nameAr" ? true : undefined}
              className="h-11 text-base"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-name-en">{t.form.nameEn}</Label>
            <Input
              id="new-name-en"
              name="nameEn"
              dir="ltr"
              lang="en"
              maxLength={80}
              value={nameEn}
              onChange={(e) => onNameEn(e.target.value)}
              placeholder={t.form.nameEnPlaceholder}
              aria-invalid={state.field === "nameEn" ? true : undefined}
              className="h-11 text-base"
            />
          </div>
        </div>
        <div className="mt-4">
          <SlugField
            id="new-slug"
            name="slug"
            value={slug}
            onChange={(v) => {
              setSlugTouched(true);
              setSlug(v);
            }}
            status={slugStatus}
            menuUrlPattern={menuUrlPattern}
            serverError={fieldError("slug")}
            action={
              slugTouched && nameEn ? (
                <button
                  type="button"
                  onClick={() => {
                    setSlug(slugify(nameEn));
                    setSlugTouched(false);
                  }}
                  className="-my-2 inline-flex h-11 items-center gap-1 rounded-md px-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Wand2 className="size-3.5" aria-hidden="true" />
                  {t.form.suggest}
                </button>
              ) : null
            }
          />
        </div>
      </SectionCard>

      <SectionCard title={t.new.look} id="sec-look">
        <p id="template-label" className="mb-3 text-sm font-medium">
          {t.new.template}
        </p>
        <TemplatePicker name="template-choice" value={template} onChange={setTemplate} color={primary} labelledBy="template-label" />

        <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-medium">{t.new.brandColor}</legend>
            <div className="flex flex-wrap gap-2">
              {BRAND_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPrimary(c)}
                  aria-label={fmt(t.new.presetColor, { color: c })}
                  aria-pressed={primary.toUpperCase() === c}
                  className={cn(
                    "relative size-11 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
                    primary.toUpperCase() === c && "ring-2 ring-foreground",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value.toUpperCase())}
                aria-label={t.new.brandColor}
                className="h-11 w-14 cursor-pointer rounded-lg border bg-background p-1"
              />
              <Input
                value={primary}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) setPrimary((v.startsWith("#") ? v : `#${v}`).toUpperCase());
                }}
                dir="ltr"
                maxLength={7}
                aria-label={t.new.brandColorHex}
                aria-invalid={!/^#[0-9A-F]{6}$/.test(primary) || state.field === "primary" ? true : undefined}
                className="h-11 w-32 font-mono text-base uppercase"
              />
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="new-currency">{t.new.currency}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="new-currency" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="min-h-10">
                    <span dir="ltr" className="font-mono">{c.code}</span>
                    <span className="text-muted-foreground">{pick(c.symbol, lang)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t.new.owner} id="sec-owner">
        <div className="space-y-2">
          <Label htmlFor="new-owner">{t.new.ownerEmail}</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="new-owner"
              name="ownerEmail"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              dir="ltr"
              maxLength={254}
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder={t.new.ownerEmailPlaceholder}
              aria-invalid={state.field === "ownerEmail" ? true : undefined}
              aria-describedby="new-owner-hint"
              className="h-11 ps-10 text-base"
            />
          </div>
          <p id="new-owner-hint" className="text-xs text-muted-foreground">
            {mode === "local" ? t.new.ownerEmailHintLocal : t.new.ownerEmailHintSupabase}
          </p>
        </div>
      </SectionCard>

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/90 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button type="submit" disabled={pending || blocked} aria-busy={pending} className="h-12 w-full gap-2 text-base sm:w-auto sm:px-8">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
          {pending ? t.new.submitting : t.new.submit}
        </Button>
      </div>
    </motion.form>
  );
}

function CreatedPanel({ state, onAnother }: { state: CreateRestaurantState; onAnother: () => void }) {
  const { lang } = useI18n();
  const t = useMessages("admin");
  const reduce = useReducedMotion();
  const errorMessage = useAdminErrorMessage();
  const edit = useEditMenu();
  const created = state.created!;
  const owner = state.owner;
  const name = pick({ ar: created.nameAr, en: created.nameEn }, lang);

  return (
    <AnimatePresence>
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="space-y-5 rounded-3xl border bg-background p-6 shadow-sm sm:p-8"
        role="status"
      >
        <div className="flex items-start gap-4">
          <motion.span
            initial={reduce ? false : { scale: 0.4, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600"
          >
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </motion.span>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{fmt(t.new.successTitle, { name })}</h2>
            <p className="text-sm text-muted-foreground">{t.new.successBody}</p>
            <p dir="ltr" className="truncate pt-1 text-start font-mono text-xs text-muted-foreground">
              {created.publicUrl}
            </p>
          </div>
        </div>

        {owner?.status === "created" && owner.tempPassword ? <TempPasswordCard email={owner.email} password={owner.tempPassword} /> : null}
        {owner?.status === "invited" ? <FormAlert tone="success" message={fmt(t.new.invited, { email: owner.email })} /> : null}
        {owner?.status === "linked" ? <FormAlert tone="success" message={fmt(t.new.linkedExisting, { email: owner.email })} /> : null}
        {owner?.status === "failed" ? (
          <FormAlert message={fmt(t.new.inviteFailed, { reason: errorMessage(owner.error) })} />
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
          <Button className="h-11 gap-2" onClick={() => edit.open(created.id)} disabled={edit.pending} aria-busy={edit.pending}>
            {edit.pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <PencilLine className="size-4" aria-hidden="true" />}
            {t.new.editMenu}
          </Button>
          <Button asChild variant="outline" className="h-11 gap-2">
            <a href={created.publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" aria-hidden="true" />
              {t.new.viewMenu}
            </a>
          </Button>
          <Button asChild variant="outline" className="h-11 gap-2">
            <Link href={`/${lang}/admin/${created.id}`}>
              <Settings2 className="size-4" aria-hidden="true" />
              {t.new.settings}
            </Link>
          </Button>
          <Button variant="ghost" className="h-11 gap-2" onClick={onAnother}>
            <Plus className="size-4" aria-hidden="true" />
            {t.new.createAnother}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
