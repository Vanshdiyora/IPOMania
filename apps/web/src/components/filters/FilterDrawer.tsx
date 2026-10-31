import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/Button";

export function FilterDrawer({
  open,
  title = "Filters",
  activeCount = 0,
  onClose,
  onReset,
  onApply,
  children,
}: {
  open: boolean;
  title?: string;
  activeCount?: number;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 h-full w-full bg-slate-950/25 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl md:w-[420px] md:max-w-[calc(100vw-2rem)]"
      >
        <header className="flex min-h-[72px] items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-navy">{title}</h2>
            {activeCount > 0 ? (
              <p className="mt-0.5 text-sm text-muted">
                {activeCount} active {activeCount === 1 ? "filter" : "filters"}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close filters"
            className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg text-muted hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
            onClick={onClose}
          >
            <X size={21} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {children}
        </div>
        <footer className="grid grid-cols-[auto_1fr] gap-3 border-t border-border bg-white px-5 py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" onClick={onReset}>
            Reset all
          </Button>
          <Button onClick={onApply}>Apply filters</Button>
        </footer>
      </section>
    </div>
  );
}

export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mb-5 rounded-xl border border-border bg-white p-4">
      <legend className="px-1 text-sm font-bold uppercase tracking-wide text-navy">{title}</legend>
      {children}
    </fieldset>
  );
}
