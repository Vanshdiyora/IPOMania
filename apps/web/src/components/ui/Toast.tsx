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
  const toneStyles = {
    success: {
      accent: "bg-success",
      icon: "border-success-border bg-success-bg text-success",
      progress: "bg-success",
    },
    error: {
      accent: "bg-danger",
      icon: "border-danger-border bg-danger-bg text-danger",
      progress: "bg-danger",
    },
    info: {
      accent: "bg-info",
      icon: "border-info-border bg-info-bg text-info",
      progress: "bg-info",
    },
  }[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="pointer-events-auto relative isolate w-full overflow-hidden rounded-2xl border border-border bg-surface p-4 pr-3 shadow-[0_18px_42px_-20px_rgba(15,23,42,0.35)] animate-fade-in"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${toneStyles.accent}`} aria-hidden="true" />
      <div className="flex gap-3 pl-1">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${toneStyles.icon}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="text-[15px] font-semibold leading-5 text-ink">{title}</p>
          {description && <div className="mt-1 text-sm leading-5 text-muted">{description}</div>}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(id)}
          className="-mt-1 flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-xl text-subtle transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-surface-subtle" aria-hidden="true">
        <span
          className={`block h-full origin-left ${toneStyles.progress} animate-toast-timer motion-reduce:animate-none`}
          style={{ animationDuration: `${duration}ms` }}
        />
      </span>
    </div>
  );
}

export function ToastViewport({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-4 top-4 z-[70] flex flex-col gap-3 sm:left-auto sm:right-5 sm:w-full sm:max-w-[25rem]"
      aria-live="polite"
    >
      {children}
    </div>,
    document.body,
  );
}
