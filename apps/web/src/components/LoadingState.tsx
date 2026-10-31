import { LoaderCircle } from "lucide-react";

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Loading" }: LoadingStateProps) {
  return (
    <div
      className="flex min-h-24 items-center justify-center gap-3 text-base text-muted"
      role="status"
      aria-live="polite"
    >
      <LoaderCircle aria-hidden="true" className="animate-spin text-action" size={24} />
      <span>{label}</span>
    </div>
  );
}
