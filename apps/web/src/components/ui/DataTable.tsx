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
      className={cn(
        "w-full touch-pan-x overflow-x-auto overscroll-x-contain rounded-2xl border border-border bg-surface shadow-card [&_thead]:bg-[#F0EBFF] [&_thead]:text-[#424A70] [&_thead_th]:font-bold [&_tbody_tr]:border-b [&_tbody_tr]:border-border/80 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-[#FAF8FF]",
      )}
      tabIndex={0}
      role="region"
      aria-label="Scrollable data table. Use Shift and mouse wheel or arrow keys to view more columns."
    >
      <div className="overflow-hidden" style={{ minWidth }}>
        <table className={cn("w-full border-collapse text-left text-sm", className)}>
          {children}
        </table>
      </div>
    </div>
  );
}
