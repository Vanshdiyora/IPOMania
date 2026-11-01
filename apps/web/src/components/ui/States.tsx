import type { ReactNode } from "react";
import { AlertCircle, FileSearch, SearchX, TrendingUp } from "lucide-react";
import { cn } from "../../lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-6",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-subtle text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** No search results empty state */
export function NoResultsState({ query, onClear }: { query?: string; onClear?: () => void }) {
  return (
    <EmptyState
      icon={<SearchX size={26} />}
      title={query ? `No results for "${query}"` : "No results found"}
      description="Try adjusting your search or filters to find what you're looking for."
      action={
        onClear ? (
          <button
            type="button"
            className="text-sm font-semibold text-action hover:underline"
            onClick={onClear}
          >
            Clear filters
          </button>
        ) : undefined
      }
    />
  );
}

/** No data at all empty state */
export function NoDataState({
  title = "No data yet",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <EmptyState
      icon={<FileSearch size={26} />}
      title={title}
      description={description ?? "Get started by creating your first record."}
      action={action}
    />
  );
}

/** Error state */
interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center py-10 px-6 text-center", className)}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-bg text-danger">
        <AlertCircle size={26} />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-muted leading-relaxed">{message}</p>}
      {onRetry && (
        <button
          type="button"
          className="mt-5 text-sm font-semibold text-action hover:underline"
          onClick={onRetry}
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Inline error notice (for API call failures) */
export function ErrorNotice({ error, className }: { error: unknown; className?: string }) {
  const message =
    error instanceof Error ? error.message : "Something went wrong. Please try again.";

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

/** Success notice */
export function SuccessNotice({ message, className }: { message: string; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-success-border bg-success-bg px-4 py-3 text-sm text-success",
        className,
      )}
    >
      <TrendingUp className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
