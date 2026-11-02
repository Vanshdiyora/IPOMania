import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { SideDrawer } from "../ui/SideDrawer";

export function FilterDrawer({
  open,
  title = "Filters",
  activeCount = 0,
  onClose,
  onReset,
  onApply,
  children,
}: {
  open: boolean;
  title?: string;
  activeCount?: number;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  children: ReactNode;
}) {
  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={title}
      description={
        activeCount > 0
          ? `${activeCount} active ${activeCount === 1 ? "filter" : "filters"}`
          : "Choose filters to narrow the results."
      }
      className="max-w-[450px]"
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Button variant="outline" onClick={onReset}>
            Reset all
          </Button>
          <Button onClick={onApply}>Apply filters</Button>
        </div>
      }
    >
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
