import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

type SideDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function SideDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: SideDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = `side-drawer-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const descriptionId = description ? `${titleId}-description` : undefined;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    window.requestAnimationFrame(() =>
      panel?.querySelector<HTMLElement>("[autofocus], input, button")?.focus(),
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/40"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          "relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl",
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-slate-950">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close drawer">
            <X className="h-5 w-5" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="border-t bg-white px-6 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
