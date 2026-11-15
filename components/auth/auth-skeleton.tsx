import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder with the same shape as the auth cards (shown while the session is checked). */
export function AuthCardSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3 rounded-lg" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="space-y-5">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </div>
  );
}
