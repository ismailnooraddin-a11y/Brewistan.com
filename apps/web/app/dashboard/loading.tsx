import { Skeleton } from '@/components/ui';

// Mirrors the real page layout: title, KPI panel, then a large content block.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white p-5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-3 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-6 h-48 w-full" />
      </div>
    </div>
  );
}
