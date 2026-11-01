import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "info";

export type ToastProps = {
  id: string;
  title: string;
  description?: ReactNode;
  tone?: ToastTone;
  duration?: number;
  onDismiss: (id: string) => void;
};

export function Toast({
  id,
  title,
  description,
  tone = "info",
  duration = 5000,
  onDismiss,
}: ToastProps) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(id), duration);
    return () => window.clearTimeout(timeout);
  }, [duration, id, onDismiss]);

  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? CircleAlert : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-sm gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
    >
      <Icon
        className={`mt-0.5 h-5 w-5 shrink-0 ${tone === "success" ? "text-green-700" : tone === "error" ? "text-red-700" : "text-blue-700"}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-950">{title}</p>
        {description && <div className="mt-1 text-sm text-slate-600">{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="h-8 w-8 shrink-0 rounded-md text-slate-500 hover:bg-slate-100"
        aria-label="Dismiss notification"
      >
        <X className="mx-auto h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastViewport({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3"
      aria-live="polite"
    >
      {children}
    </div>,
    document.body,
  );
}
