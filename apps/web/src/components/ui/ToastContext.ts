import { createContext, useContext, type ReactNode } from "react";

export type ToastInput = {
  title: string;
  description?: ReactNode;
  tone?: "success" | "error" | "info";
  duration?: number;
};

type ToastContextValue = { notify: (toast: ToastInput) => void };

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider.");
  return context;
}
