"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/i18n-provider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsDesktop } from "./hooks";

/**
 * A dialog on desktop and a bottom sheet on phones (thumb-friendly), with the same API.
 * The body scrolls; the footer (actions) stays visible.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const desktop = useIsDesktop();
  const { dir } = useI18n();

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent dir={dir} className={cn("flex max-h-[min(88dvh,820px)] flex-col gap-0 p-0 sm:max-w-xl", className)}>
          <DialogHeader className="border-b p-5 pe-12">
            <DialogTitle className="text-lg">{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
          {footer && <DialogFooter className="m-0 rounded-b-xl border-t bg-muted/40 p-4">{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        dir={dir}
        className={cn("dash-sheet max-h-[92dvh] gap-0 rounded-t-3xl p-0", className)}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25" aria-hidden />
        <SheetHeader className="px-5 pt-3 pb-3 pe-12">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && (
          <SheetFooter className="mt-0 flex-row border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] *:flex-1">
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
