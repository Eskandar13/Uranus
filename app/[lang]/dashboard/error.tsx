"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { useMessages } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";

/** Friendly error boundary for dashboard pages (renders inside the dashboard shell). */
export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry?: () => void }) {
  const t = useMessages("dashboard");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center" role="alert">
      <span className="grid size-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
        <TriangleAlert className="size-7" aria-hidden />
      </span>
      <div>
        <h1 className="text-lg font-semibold">{t.errors.boundaryTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.errors.boundaryBody}</p>
      </div>
      <Button className="h-11 rounded-xl px-5" onClick={() => (retry ? retry() : window.location.reload())}>
        <RotateCcw aria-hidden />
        {t.errors.retry}
      </Button>
    </div>
  );
}
