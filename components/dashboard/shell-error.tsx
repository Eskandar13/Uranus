"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import { useMessages } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";

/**
 * Shown by the dashboard layout when loading the session / restaurant list fails. An error.tsx
 * cannot catch errors thrown by the layout of its own segment, so the layout renders this itself.
 */
export function ShellError() {
  const t = useMessages("dashboard");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
      <span className="grid size-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
        <TriangleAlert className="size-7" aria-hidden />
      </span>
      <div>
        <h1 className="text-lg font-semibold">{t.errors.boundaryTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.errors.boundaryBody}</p>
      </div>
      <Button className="h-11 rounded-xl px-5" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
        {t.errors.retry}
      </Button>
    </div>
  );
}
