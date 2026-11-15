"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Globe, Loader2, PencilLine, Save, Trash2, TriangleAlert, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormAlert } from "@/components/auth/auth-card";
import { useI18n, useMessages } from "@/components/providers/i18n-provider";
import { inviteOwnerAction, removeMemberAction, updateRestaurantAdminAction } from "@/app/[lang]/admin/actions";
import type { Plan } from "@/lib/data/types";
import { fmt } from "@/lib/i18n/config";
import { DeleteRestaurantDialog, useEditMenu, type DialogRestaurant } from "./restaurant-dialogs";
import { SectionCard, TempPasswordCard, useAdminErrorMessage } from "./shared";
import { SlugField, useSlugStatus } from "./slug-field";
import { PLANS, type MemberRow, type OwnerOutcome, type UpdateRestaurantState } from "./types";

export interface SettingsRestaurant extends DialogRestaurant {
  plan: Plan;
  customDomain: string | null;
}

/** Plan, live switch, menu address and custom domain (agency-only settings). */
export function PlatformSettingsForm({ restaurant, menuUrlPattern }: { restaurant: SettingsRestaurant; menuUrlPattern: string }) {
  const { lang } = useI18n();
  const t = useMessages("admin");
  const errorMessage = useAdminErrorMessage();
  const [state, formAction, pending] = useActionState<UpdateRestaurantState, FormData>(updateRestaurantAdminAction, {});
  const [plan, setPlan] = useState<Plan>(restaurant.plan);
  const [active, setActive] = useState(restaurant.isActive);
  const [slug, setSlug] = useState(restaurant.slug);
  const [domain, setDomain] = useState(restaurant.customDomain ?? "");
  const slugStatus = useSlugStatus(lang, slug, restaurant.id);
  const lastNonce = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!state.nonce || state.nonce === lastNonce.current) return;
    lastNonce.current = state.nonce;
    if (state.ok) toast.success(t.detail.saved);
    else if (!state.field) toast.error(errorMessage(state.error));
  }, [state, t.detail.saved, errorMessage]);

  const slugChanged = slug !== restaurant.slug;
  const blocked = slugStatus === "taken" || slugStatus === "invalid" || slugStatus === "reserved";
  const fieldError = (f: string) => (state.field === f && state.error ? errorMessage(state.error) : null);

  return (
    <SectionCard title={t.detail.settings} description={t.detail.settingsBody} id="sec-platform">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="id" value={restaurant.id} />
        <input type="hidden" name="plan" value={plan} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="set-plan">{t.detail.plan}</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
              <SelectTrigger id="set-plan" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => (
                  <SelectItem key={p} value={p} className="min-h-10">
                    {t.plans[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="set-active">{t.detail.active}</Label>
              <p className="text-xs text-muted-foreground">{t.detail.activeHint}</p>
            </div>
            <Switch id="set-active" name="isActive" checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <SlugField
          id="set-slug"
          name="slug"
          value={slug}
          onChange={setSlug}
          status={slugStatus}
          menuUrlPattern={menuUrlPattern}
          serverError={fieldError("slug")}
        />
        <AnimatePresence initial={false}>
          {slugChanged ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 overflow-hidden rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {t.detail.slugWarning}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <div className="space-y-2">
          <Label htmlFor="set-domain">{t.detail.customDomain}</Label>
          <div className="relative">
            <Globe className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="set-domain"
              name="customDomain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              dir="ltr"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={253}
              placeholder={t.detail.customDomainPlaceholder}
              aria-invalid={state.field === "customDomain" ? true : undefined}
              aria-describedby="set-domain-hint"
              className="h-11 ps-10 font-mono text-base"
            />
          </div>
          <p id="set-domain-hint" className={fieldError("customDomain") ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {fieldError("customDomain") ?? t.detail.customDomainHint}
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" className="h-11 gap-2 px-5" disabled={pending || blocked} aria-busy={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {pending ? t.detail.saving : t.detail.save}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

/** Owners/staff with "add owner" (invite) and "remove access". */
export function MembersPanel({ restaurantId, members }: { restaurantId: string; members: MemberRow[] }) {
  const { lang } = useI18n();
  const t = useMessages("admin");
  const c = useMessages("common");
  const reduce = useReducedMotion();
  const errorMessage = useAdminErrorMessage();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<OwnerOutcome | null>(null);
  const [inviting, startInvite] = useTransition();
  const [removing, setRemoving] = useState<MemberRow | null>(null);
  const [removePending, startRemove] = useTransition();

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startInvite(async () => {
      let res: Awaited<ReturnType<typeof inviteOwnerAction>>;
      try {
        res = await inviteOwnerAction({ lang, restaurantId, email });
      } catch {
        setError(errorMessage("unknown"));
        return;
      }
      if (res.ok) {
        setOutcome(res.owner);
        setEmail("");
        toast.success(t.detail.invited);
      } else {
        setError(errorMessage(res.error));
      }
    });
  }

  function remove() {
    const target = removing;
    if (!target) return;
    startRemove(async () => {
      const res = await removeMemberAction({ lang, restaurantId, userId: target.userId });
      if (res.ok) {
        toast.success(t.detail.removed);
        setRemoving(null);
      } else {
        toast.error(errorMessage(res.error));
      }
    });
  }

  return (
    <SectionCard title={t.detail.members} description={t.detail.membersBody} id="sec-members">
      {members.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{t.detail.noMembers}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          <AnimatePresence initial={false}>
            {members.map((m) => (
              <motion.li
                key={m.userId}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 px-3 py-2"
              >
                <span
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase"
                  aria-hidden="true"
                >
                  {(m.email || "?").slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm" dir="ltr">
                  {m.email || m.userId}
                </span>
                <Badge variant={m.role === "owner" ? "secondary" : "outline"}>{t.detail.roles[m.role]}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 text-muted-foreground hover:text-destructive"
                  aria-label={fmt(t.detail.removeMember, { email: m.email })}
                  onClick={() => setRemoving(m)}
                >
                  <UserMinus className="size-4" aria-hidden="true" />
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <form onSubmit={invite} className="mt-5 space-y-2">
        <Label htmlFor="invite-email">{t.detail.inviteEmail}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="invite-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.new.ownerEmailPlaceholder}
            aria-invalid={error ? true : undefined}
            className="h-11 flex-1 text-base"
          />
          <Button type="submit" className="h-11 gap-2" disabled={inviting || !email.includes("@")} aria-busy={inviting}>
            {inviting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
            {inviting ? t.detail.inviting : t.detail.invite}
          </Button>
        </div>
        <FormAlert message={error} />
      </form>

      {outcome?.tempPassword ? (
        <div className="mt-4">
          <TempPasswordCard email={outcome.email} password={outcome.tempPassword} />
        </div>
      ) : outcome?.status === "invited" ? (
        <div className="mt-4">
          <FormAlert tone="success" message={fmt(t.new.invited, { email: outcome.email })} />
        </div>
      ) : null}

      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{fmt(t.detail.removeMemberTitle, { email: removing?.email ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t.detail.removeMemberBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">{c.cancel}</AlertDialogCancel>
            <Button variant="destructive" className="h-11" onClick={remove} disabled={removePending} aria-busy={removePending}>
              {removePending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserMinus className="size-4" aria-hidden="true" />}
              {t.detail.removeConfirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}

export function DangerZone({ restaurant }: { restaurant: DialogRestaurant }) {
  const { lang } = useI18n();
  const t = useMessages("admin");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <SectionCard title={t.detail.danger} description={t.detail.dangerBody} tone="danger" id="sec-danger">
      <Button variant="destructive" className="h-11 gap-2" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden="true" />
        {t.detail.deleteRestaurant}
      </Button>
      <DeleteRestaurantDialog
        restaurant={restaurant}
        open={open}
        onOpenChange={setOpen}
        onDeleted={() => router.replace(`/${lang}/admin`)}
      />
    </SectionCard>
  );
}

export function EditMenuButton({ restaurantId }: { restaurantId: string }) {
  const t = useMessages("admin");
  const edit = useEditMenu();
  return (
    <Button className="h-11 gap-2" onClick={() => edit.open(restaurantId)} disabled={edit.pending} aria-busy={edit.pending}>
      {edit.pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <PencilLine className="size-4" aria-hidden="true" />}
      {t.actions.editMenu}
    </Button>
  );
}
