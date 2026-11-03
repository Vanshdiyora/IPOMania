import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";

export function ListToolbar({
  search,
  searchPlaceholder,
  searchLabel,
  activeFilterCount = 0,
  onSearchChange,
  onOpenFilters,
  onClearFilters,
  className,
}: {
  search: string;
  searchPlaceholder: string;
  searchLabel?: string;
  activeFilterCount?: number;
  onSearchChange: (value: string) => void;
  onOpenFilters: () => void;
  onClearFilters?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      <label className="relative min-w-0 flex-1 sm:max-w-xl">
        <span className="sr-only">{searchLabel ?? searchPlaceholder}</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="min-h-touch w-full rounded-xl border border-border bg-white py-2 pr-10 pl-10 text-base text-ink placeholder:text-muted shadow-sm shadow-indigo-950/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:border-border-focus"
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-2 sm:flex-none"
          aria-haspopup="dialog"
          onClick={onOpenFilters}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filters
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-action px-2 py-0.5 text-xs font-bold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
        {activeFilterCount > 0 && onClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="min-h-touch px-2 text-sm font-semibold text-action no-underline transition-colors hover:text-navy visited:text-action"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
