import { Check, ChevronDown, LoaderCircle, Search, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
  badge?: string;
};

type SearchableSelectProps = {
  label: string;
  placeholder: string;
  options: SearchableSelectOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  loading?: boolean;
};

export function SearchableSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  multiple = false,
  searchPlaceholder = "Search options...",
  emptyLabel = "No matching options.",
  disabled = false,
  loading = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const selectedOptions = options.filter((option) => selected.includes(option.value));
  const filtered = options.filter((option) =>
    `${option.label} ${option.description ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportPadding = 12;
    const width = Math.min(Math.max(rect.width, 300), window.innerWidth - viewportPadding * 2);
    setPosition({
      top: Math.min(rect.bottom + 8, window.innerHeight - 120),
      left: Math.min(
        Math.max(viewportPadding, rect.left),
        window.innerWidth - width - viewportPadding,
      ),
      width,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target))
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const select = (optionValue: string) => {
    if (multiple) {
      onChange(
        selected.includes(optionValue)
          ? selected.filter((item) => item !== optionValue)
          : [...selected, optionValue],
      );
      return;
    }
    onChange(optionValue === selected[0] ? "" : optionValue);
    setOpen(false);
  };
  const selectedLabel =
    loading && !selectedOptions.length
      ? "Loading options…"
      : multiple
        ? selectedOptions.length
          ? `${selectedOptions.length} selected`
          : placeholder
        : (selectedOptions[0]?.label ?? placeholder);

  return (
    <div className="min-w-0">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-touch w-full items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2 text-left text-base text-ink hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selectedOptions.length ? "truncate" : "truncate text-muted"}>
          {selectedLabel}
        </span>
        {loading ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin text-muted" aria-hidden="true" />
        ) : (
          <ChevronDown
            className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>
      {loading ? (
        <span className="sr-only" role="status">{`Loading ${label.toLowerCase()} options`}</span>
      ) : null}
      {multiple && selectedOptions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => select(option.value)}
              className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full bg-[#EAF0F6] px-2.5 py-1 text-xs font-semibold text-navy hover:bg-[#DCE6F0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
            >
              <span className="truncate">{option.label}</span>
              <X className="size-3.5 shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            aria-label={label}
            aria-multiselectable={multiple || undefined}
            onKeyDownCapture={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                event.preventDefault();
                setOpen(false);
                triggerRef.current?.focus();
                return;
              }
              if (event.key !== "Tab") return;
              event.stopPropagation();
              const focusable = Array.from(
                panelRef.current?.querySelectorAll<HTMLElement>(
                  "input:not(:disabled), button:not(:disabled)",
                ) ?? [],
              );
              const current = focusable.indexOf(document.activeElement as HTMLElement);
              if (
                (event.shiftKey && current <= 0) ||
                (!event.shiftKey && current === focusable.length - 1)
              ) {
                event.preventDefault();
                setOpen(false);
                triggerRef.current?.focus();
              }
            }}
            className="fixed z-[70] overflow-hidden rounded-xl border border-border bg-white shadow-xl"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            <div className="border-b border-border p-3">
              <label className="sr-only" htmlFor={`${listId}-search`}>
                {searchPlaceholder}
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-border px-3">
                <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
                <input
                  ref={searchRef}
                  id={`${listId}-search`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      panelRef.current
                        ?.querySelector<HTMLButtonElement>("[data-select-option]")
                        ?.focus();
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="min-h-touch w-full bg-transparent text-sm outline-none placeholder:text-muted"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear option search"
                  >
                    <X className="size-4 text-muted" />
                  </button>
                ) : null}
              </div>
              {multiple && options.length > 1 ? (
                <div className="mt-2 flex justify-between gap-3 text-sm font-semibold">
                  <button
                    type="button"
                    className="text-action underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
                    onClick={() => onChange(options.map((option) => option.value))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-action underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
                    onClick={() => onChange([])}
                  >
                    Clear selection
                  </button>
                </div>
              ) : selected.length ? (
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold text-action underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
                  onClick={() => onChange(multiple ? [] : "")}
                >
                  Clear selection
                </button>
              ) : null}
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5">
              {filtered.length ? (
                filtered.map((option, index) => {
                  const isSelected = selected.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      data-select-option
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => select(option.value)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                          event.preventDefault();
                          const optionsInPanel = Array.from(
                            panelRef.current?.querySelectorAll<HTMLButtonElement>(
                              "[data-select-option]",
                            ) ?? [],
                          );
                          optionsInPanel[
                            Math.max(
                              0,
                              Math.min(
                                optionsInPanel.length - 1,
                                index + (event.key === "ArrowDown" ? 1 : -1),
                              ),
                            )
                          ]?.focus();
                        }
                      }}
                      className={`flex min-h-touch w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy ${isSelected ? "bg-[#EAF0F6]" : ""}`}
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded border ${isSelected ? "border-action bg-action text-white" : "border-slate-400 bg-white"}`}
                        aria-hidden="true"
                      >
                        {isSelected ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">
                          {option.label}
                        </span>
                        {option.description ? (
                          <span className="block truncate text-xs text-muted">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                      {option.badge ? (
                        <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-navy">
                          {option.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-5 text-center text-sm text-muted">{emptyLabel}</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
