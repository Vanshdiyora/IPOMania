import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { SideDrawer } from "../ui/SideDrawer";

export function FilterDrawer({
  open,
  title = "Filters",
  description = "Refine the current results.",
  activeCount = 0,
  onClose,
  onReset,
  onApply,
  applyDisabled = false,
  children,
}: {
  open: boolean;
  title?: string;
  description?: string;
  activeCount?: number;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  applyDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      className="max-w-[450px]"
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Button variant="outline" onClick={onReset}>
            Reset all
          </Button>
          <Button disabled={applyDisabled} onClick={onApply}>
            Apply filters{activeCount ? ` (${activeCount})` : ""}
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
        <span className="text-sm font-semibold text-muted">
          {activeCount
            ? `${activeCount} active ${activeCount === 1 ? "filter" : "filters"}`
            : "No active filters"}
        </span>
      </div>
      {children}
    </SideDrawer>
  );
}

export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mb-5 rounded-xl border border-border bg-white p-4">
      <legend className="px-1 text-sm font-bold uppercase tracking-wide text-navy">{title}</legend>
      {children}
    </fieldset>
  );
}
