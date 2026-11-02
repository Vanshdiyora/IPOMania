import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { ToastContext, type ToastInput } from "./ToastContext";

export type ToastTone = "success" | "error" | "info";

export type ToastProps = {
  id: string;
  title: string;
  description?: ReactNode;
  tone?: ToastTone;
  duration?: number;
  onDismiss: (id: string) => void;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const notify = useCallback(
    (toast: ToastInput) => {
      const id = `toast-${++nextId.current}`;
      setToasts((current) => [...current, { ...toast, id, onDismiss: dismiss }].slice(-4));
    },
    [dismiss],
  );
  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport>
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </ToastViewport>
    </ToastContext.Provider>
  );
}

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
      className="pointer-events-auto flex w-full max-w-sm gap-3 rounded-xl border border-border bg-surface p-4 shadow-dropdown"
    >
      <Icon
        className={`mt-0.5 h-5 w-5 shrink-0 ${tone === "success" ? "text-success" : tone === "error" ? "text-danger" : "text-info"}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="min-h-touch min-w-touch shrink-0 rounded-lg text-muted hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus"
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
