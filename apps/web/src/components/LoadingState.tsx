import { LoaderCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface LoadingStateProps {
  label?: string;
  /** Compact inline variant */
  inline?: boolean;
  /** Full-page centered loading */
  fullPage?: boolean;
  className?: string;
}

export function LoadingState({
  label = "Loading",
  inline = false,
  fullPage = false,
  className,
}: LoadingStateProps) {
  if (fullPage) {
    return (
      <div
        className={cn(
          "flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-border" />
          <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-4 border-action border-t-transparent" />
        </div>
        <div className="text-center">
          <p className="text-base font-medium text-ink">{label}</p>
          <p className="mt-1 text-sm text-muted">Please wait a moment</p>
        </div>
      </div>
    );
  }

  if (inline) {
    return (
      <span
        className={cn("inline-flex items-center gap-2 text-sm text-muted", className)}
        role="status"
        aria-live="polite"
      >
        <LoaderCircle aria-hidden="true" className="animate-spin text-action" size={14} />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <div
      className={cn("flex min-h-32 flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-live="polite"
    >
      <LoaderCircle aria-hidden="true" className="animate-spin text-action" size={28} />
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  );
}
