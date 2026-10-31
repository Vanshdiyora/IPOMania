import { cn } from "../../lib/utils";

interface SkeletonProps {
  className?: string;
  /** Number of lines to show (stacked vertically) */
  lines?: number;
}

/** Single-element skeleton pulse */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

/** Multi-line skeleton paragraph */
export function SkeletonText({ lines = 3 }: SkeletonProps) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4 rounded", i === lines - 1 ? "w-3/4" : "w-full")} />
      ))}
    </div>
  );
}

/** Card-shaped skeleton for loading states */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-surface p-6 shadow-card", className)}
      aria-hidden="true"
    >
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

/** Stats metric skeleton */
export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-surface p-6 shadow-card", className)}
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-1/2 mb-3" />
      <Skeleton className="h-8 w-2/3 mb-2" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

/** Table skeleton */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border" aria-hidden="true">
      <div className="border-b border-border bg-canvas px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4 flex-1", c === 0 ? "w-1/4 flex-none" : "")} />
          ))}
        </div>
      ))}
    </div>
  );
}
