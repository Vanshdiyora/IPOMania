import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function DataTable({
  children,
  className,
  minWidth = "760px",
}: {
  children: ReactNode;
  className?: string;
  minWidth?: string;
}) {
  return (
    <div
      className={cn("w-full overflow-x-auto rounded-xl border border-border bg-white")}
      tabIndex={0}
      role="region"
      aria-label="Scrollable data table"
    >
      <div className="overflow-hidden" style={{ minWidth }}>
        <table className={cn("w-full border-collapse text-left text-sm", className)}>
          {children}
        </table>
      </div>
    </div>
  );
}
