import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";
import { useModalLayer } from "./useModalLayer";

type SideDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  busy?: boolean;
};

export function SideDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  busy = false,
}: SideDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = description ? `${titleId}-description` : undefined;
  const requestClose = () => { if (!busy) onClose(); };
  useModalLayer(open, panelRef, requestClose);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/40"
        aria-label="Close drawer"
        disabled={busy}
        onClick={requestClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-busy={busy}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          "drawer-panel relative flex h-dvh w-full max-w-xl flex-col bg-white shadow-2xl",
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
          <Button size="icon" variant="ghost" onClick={requestClose} aria-label="Close drawer"
        disabled={busy}>
            <X className="h-5 w-5" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>
        {footer && <footer className="shrink-0 border-t bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
