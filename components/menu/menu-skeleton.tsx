/** Loading state with shimmer (server-safe: no hooks, no data). */
export function MenuSkeleton({ label = "…" }: { label?: string }) {
  return (
    <div className="min-h-dvh bg-background" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="m-shimmer h-[42svh] min-h-[280px] rounded-b-[2.25rem]" />
      <div className="mx-auto -mt-16 max-w-2xl px-4">
        <div className="flex flex-col items-center rounded-[2rem] bg-background/80 px-5 pt-6 pb-6 shadow-sm">
          <div className="m-shimmer size-20 rounded-[1.5rem]" />
          <div className="m-shimmer mt-4 h-7 w-48 rounded-full" />
          <div className="m-shimmer mt-3 h-4 w-64 max-w-full rounded-full" />
          <div className="mt-5 flex gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="m-shimmer size-12 rounded-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-7xl px-4 md:px-8">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="m-shimmer h-10 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-3xl">
              <div className="m-shimmer aspect-[4/3]" />
              <div className="space-y-2 p-3">
                <div className="m-shimmer h-4 w-3/4 rounded-full" />
                <div className="m-shimmer h-3 w-1/2 rounded-full" />
                <div className="m-shimmer mt-3 h-4 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
