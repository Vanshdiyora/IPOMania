import { X } from "lucide-react";

export type ActiveFilterChip = { key: string; label: string };

export function ActiveFilterChips({
  filters,
  onRemove,
  onClear,
}: {
  filters: ActiveFilterChip[];
  onRemove: (key: string) => void;
  onClear: () => void;
}) {
  if (!filters.length) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3"
      aria-label="Applied filters"
    >
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onRemove(filter.key)}
          className="inline-flex min-h-touch items-center gap-1.5 rounded-full bg-[#EAF0F6] px-3 py-2 text-sm font-semibold text-navy hover:bg-[#DCE6F0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
          aria-label={`Remove ${filter.label}`}
        >
          <span>{filter.label}</span>
          <X size={15} aria-hidden="true" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="min-h-touch px-2 text-sm font-semibold text-action underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
      >
        Clear all
      </button>
    </div>
  );
}
