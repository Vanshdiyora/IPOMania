import { cn } from "../../lib/utils";

interface SkeletonProps {
  className?: string;
  /** Number of lines to show (stacked vertically) */
  lines?: number;
}

interface SkeletonPageProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/** Single-element skeleton pulse */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function SkeletonPage({ label, children, className }: SkeletonPageProps) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className={cn("space-y-6", className)}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-6">
        {children}
      </div>
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <Skeleton className="h-8 w-2/5 max-w-72" />
      <Skeleton className="h-4 w-3/5 max-w-xl" />
    </div>
  );
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

export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonStatCard key={index} />
      ))}
    </div>
  );
}

/** Table skeleton */
export function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-xl border border-border bg-surface", className)}
      aria-hidden="true"
    >
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

export function SkeletonTableRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, row) => (
        <tr key={row} aria-hidden="true" className="border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, column) => (
            <td key={column} className="px-3 py-4">
              <Skeleton className={cn("h-4 w-full", column === 0 && "max-w-40")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonListPage({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonPage label="Loading records">
      <SkeletonPageHeader />
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-4">
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </SkeletonPage>
  );
}

export function SkeletonDetailsPage({ rows = 6 }: { rows?: number }) {
  return (
    <SkeletonPage label="Loading details">
      <SkeletonPageHeader />
      <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-5 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}

export function SkeletonFormPage({ sections = 3 }: { sections?: number }) {
  return (
    <SkeletonPage label="Loading form">
      <SkeletonPageHeader />
      {Array.from({ length: sections }).map((_, index) => (
        <div
          key={index}
          className="space-y-5 rounded-xl border border-border bg-surface p-6 shadow-card"
        >
          <Skeleton className="h-5 w-1/3" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </SkeletonPage>
  );
}

export function SkeletonFormFields({ fields = 4 }: { fields?: number }) {
  return (
    <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonIpoDetails() {
  return (
    <SkeletonPage label="Loading IPO details">
      <SkeletonPageHeader />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonStatCard key={index} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </SkeletonPage>
  );
}
