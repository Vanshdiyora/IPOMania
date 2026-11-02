import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { useModalLayer } from "./useModalLayer";

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
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
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const cancel = () => {
    if (!busy) onCancel();
  };
  useModalLayer(open, panelRef, cancel, "[data-confirmation-cancel]");

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center px-4" role="presentation">
      <button
        className="absolute inset-0 bg-slate-950/50"
        type="button"
        aria-label="Cancel"
        onClick={cancel}
        disabled={busy}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="alertdialog"
        aria-busy={busy}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="flex gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id={titleId} className="text-lg font-bold text-slate-950">
              {title}
            </h2>
            <div id={descriptionId} className="mt-2 text-sm text-slate-600">
              {description}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button data-confirmation-cancel variant="outline" onClick={cancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "default"} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
