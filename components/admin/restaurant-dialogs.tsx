"use client";

import { useState, useTransition } from "react";
import { Loader2, Power, PowerOff, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n, useMessages } from "@/components/providers/i18n-provider";
import {
  deleteRestaurantAction,
  duplicateRestaurantAction,
  editMenuAction,
  setRestaurantActiveAction,
} from "@/app/[lang]/admin/actions";
import { fmt, pick } from "@/lib/i18n/config";
import { slugify } from "@/lib/data/slug";
import { useAdminErrorMessage } from "./shared";
import { SlugField, useSlugStatus } from "./slug-field";

export interface DialogRestaurant {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
}

const useName = (r: DialogRestaurant) => {
  const { lang } = useI18n();
  return pick({ ar: r.nameAr, en: r.nameEn }, lang);
};

/** "Edit menu": sets the active restaurant then the action redirects to the dashboard. */
export function useEditMenu() {
  const { lang } = useI18n();
  const errorMessage = useAdminErrorMessage();
  const [pending, start] = useTransition();
  const open = (id: string) =>
    start(async () => {
      // On success the action redirects to the dashboard; it only returns on failure.
      const res = await editMenuAction(lang, id);
      if (res && !res.ok) toast.error(errorMessage(res.error));
    });
  return { open, pending };
}

export function DuplicateDialog({
  restaurant,
  open,
  onOpenChange,
  menuUrlPattern,
}: {
  restaurant: DialogRestaurant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuUrlPattern: string;
}) {
  const { lang } = useI18n();
  const t = useMessages("admin");
  const errorMessage = useAdminErrorMessage();
  const name = useName(restaurant);
  const [nameAr, setNameAr] = useState(restaurant.nameAr ? `${restaurant.nameAr} (نسخة)` : "");
  const [nameEn, setNameEn] = useState(restaurant.nameEn ? `${restaurant.nameEn} (copy)` : "");
  const [slug, setSlug] = useState(slugify(`${restaurant.slug}-copy`));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const status = useSlugStatus(lang, slug);
  const blocked = status === "taken" || status === "invalid" || status === "reserved" || (!nameAr.trim() && !nameEn.trim());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await duplicateRestaurantAction({ lang, sourceId: restaurant.id, slug, nameAr, nameEn });
      if (res.ok) {
        toast.success(t.duplicate.success);
        onOpenChange(false);
      } else {
        setError(errorMessage(res.error));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t.duplicate.title}</DialogTitle>
            <DialogDescription>{fmt(t.duplicate.description, { name })}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dup-name-ar">{t.form.nameAr}</Label>
              <Input id="dup-name-ar" dir="rtl" lang="ar" value={nameAr} maxLength={80} onChange={(e) => setNameAr(e.target.value)} className="h-11 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dup-name-en">{t.form.nameEn}</Label>
              <Input id="dup-name-en" dir="ltr" lang="en" value={nameEn} maxLength={80} onChange={(e) => setNameEn(e.target.value)} className="h-11 text-base" />
            </div>
          </div>
          <SlugField
            id="dup-slug"
            name="slug"
            value={slug}
            onChange={setSlug}
            status={status}
            menuUrlPattern={menuUrlPattern}
            serverError={error}
          />
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-11">
                <CancelLabel />
              </Button>
            </DialogClose>
            <Button type="submit" className="h-11" disabled={pending || blocked} aria-busy={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {pending ? t.duplicate.submitting : t.duplicate.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelLabel() {
  const c = useMessages("common");
  return <>{c.cancel}</>;
}

export function ToggleActiveDialog({
  restaurant,
  open,
  onOpenChange,
}: {
  restaurant: DialogRestaurant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useI18n();
  const t = useMessages("admin");
  const errorMessage = useAdminErrorMessage();
  const name = useName(restaurant);
  const [pending, start] = useTransition();
  const suspending = restaurant.isActive;

  function confirm() {
    start(async () => {
      const res = await setRestaurantActiveAction({ lang, id: restaurant.id, active: !suspending });
      if (res.ok) {
        toast.success(suspending ? t.toggle.suspended : t.toggle.activated);
        onOpenChange(false);
      } else {
        toast.error(errorMessage(res.error));
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{fmt(suspending ? t.toggle.suspendTitle : t.toggle.activateTitle, { name })}</AlertDialogTitle>
          <AlertDialogDescription>{suspending ? t.toggle.suspendBody : t.toggle.activateBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11">
            <CancelLabel />
          </AlertDialogCancel>
          <Button
            type="button"
            className="h-11"
            variant={suspending ? "destructive" : "default"}
            onClick={confirm}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : suspending ? (
              <PowerOff className="size-4" aria-hidden="true" />
            ) : (
              <Power className="size-4" aria-hidden="true" />
            )}
            {suspending ? t.actions.suspend : t.actions.activate}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteRestaurantDialog({
  restaurant,
  open,
  onOpenChange,
  onDeleted,
}: {
  restaurant: DialogRestaurant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const { lang } = useI18n();
  const t = useMessages("admin");
  const errorMessage = useAdminErrorMessage();
  const name = useName(restaurant);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const matches = typed.trim().toLowerCase() === restaurant.slug;
  const [before, after = ""] = t.remove.typeToConfirm.split("{slug}");

  function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!matches) return;
    start(async () => {
      const res = await deleteRestaurantAction({ lang, id: restaurant.id, confirm: typed });
      if (res.ok) {
        toast.success(t.remove.success);
        onOpenChange(false);
        onDeleted?.();
      } else {
        toast.error(errorMessage(res.error));
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped("");
        onOpenChange(o);
      }}
    >
      <AlertDialogContent>
        <form onSubmit={confirm} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{fmt(t.remove.title, { name })}</AlertDialogTitle>
            <AlertDialogDescription>{t.remove.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`confirm-${restaurant.id}`} className="font-normal">
              {before}
              <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
                {restaurant.slug}
              </code>
              {after}
            </Label>
            <Input
              id={`confirm-${restaurant.id}`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              dir="ltr"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-label={t.remove.confirmLabel}
              className="h-11 font-mono text-base"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" className="h-11">
              <CancelLabel />
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" className="h-11" disabled={!matches || pending} aria-busy={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
              {pending ? t.remove.submitting : t.remove.submit}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
