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
      className="pointer-events-auto relative isolate w-full overflow-hidden rounded-xl border border-border bg-surface px-3 py-2 shadow-[0_18px_42px_-20px_rgba(15,23,42,0.35)] animate-fade-in sm:rounded-2xl sm:p-3 sm:pr-2"
    >
      <span
        className={`absolute inset-y-0 left-0 hidden w-1 sm:block ${toneStyles.accent}`}
        aria-hidden="true"
      />
      <div className="flex items-center gap-2 sm:gap-3 sm:pl-1">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border sm:h-9 sm:w-9 ${toneStyles.icon}`}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5 text-ink sm:text-[15px]">{title}</p>
          {description && (
            <div className="text-xs leading-4 text-muted sm:mt-1 sm:text-sm sm:leading-5">
              {description}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(id)}
          className="flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-xl text-subtle transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus"
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
      className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[70] flex flex-col-reverse gap-2 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-4 sm:w-full sm:max-w-[25rem] sm:flex-col sm:gap-3"
      aria-live="polite"
    >
      {children}
    </div>,
    document.body,
  );
}
