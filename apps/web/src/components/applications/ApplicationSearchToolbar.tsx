import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "../ui/Button";

export function ApplicationSearchToolbar({
  search,
  activeFilterCount,
  onSearchChange,
  onClearSearch,
  onOpenFilters,
  onClearFilters,
}: {
  search: string;
  activeFilterCount: number;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onOpenFilters: () => void;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className="relative min-w-0 flex-1 sm:max-w-xl">
        <span className="sr-only">Search IPO or company name</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search IPO or company name..."
          className="min-h-touch w-full rounded-lg border border-border bg-white py-2 pl-10 pr-10 text-base text-ink placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear IPO search"
            onClick={onClearSearch}
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
          className="gap-2"
          aria-haspopup="dialog"
          onClick={onOpenFilters}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filters
          {activeFilterCount ? (
            <span className="rounded-full bg-action px-2 py-0.5 text-xs font-bold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
        {activeFilterCount ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="min-h-touch px-2 text-sm font-semibold text-action no-underline underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy visited:text-action"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
