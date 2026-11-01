import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>("[data-confirmation-cancel]")?.focus(),
    );
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center px-4" role="presentation">
      <button
        className="absolute inset-0 bg-slate-950/50"
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-description"
        className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="flex gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="confirmation-title" className="text-lg font-bold text-slate-950">
              {title}
            </h2>
            <div id="confirmation-description" className="mt-2 text-sm text-slate-600">
              {description}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button data-confirmation-cancel variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
