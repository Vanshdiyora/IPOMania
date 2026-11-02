import { CalendarDays } from "lucide-react";

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  const hasValue = Boolean(from || to);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Submission date</span>
        {hasValue ? (
          <button
            type="button"
            className="text-xs font-semibold text-action no-underline underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy visited:text-action"
            onClick={() => {
              onFromChange("");
              onToChange("");
            }}
          >
            Clear dates
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-muted">
          Submitted from
          <span className="relative mt-1 block">
            <CalendarDays
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => onFromChange(event.target.value)}
              className="min-h-touch w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
            />
          </span>
        </label>
        <label className="text-sm font-medium text-muted">
          Submitted to
          <span className="relative mt-1 block">
            <CalendarDays
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => onToChange(event.target.value)}
              className="min-h-touch w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
            />
          </span>
        </label>
      </div>
      {from && to && from > to ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          The end date must be on or after the start date.
        </p>
      ) : null}
    </div>
  );
}
