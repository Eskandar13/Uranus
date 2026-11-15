import { Skeleton } from "@/components/ui/skeleton";

/** Loading placeholders (Suspense fallbacks). Plain components: usable on the server. */

export function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-muted/40 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] dark:bg-background" aria-busy="true">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-4 border-e bg-sidebar px-3 py-4 lg:flex">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-auto h-14 w-full rounded-xl" />
      </aside>
      <div className="flex min-w-0 flex-col">
        <div className="sticky top-0 flex h-16 items-center gap-3 border-b bg-background px-3 lg:hidden">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-10 lg:pt-8">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <Skeleton className="h-8 w-56 rounded-lg" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

export function MenuSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-[15.5rem_1fr] xl:grid-cols-[minmax(17rem,21rem)_1fr]">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
        <div className="hidden flex-col gap-2 lg:flex">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <Skeleton className="h-8 w-44 rounded-lg" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <Skeleton className="hidden h-96 rounded-2xl lg:block" />
      </div>
    </div>
  );
}
