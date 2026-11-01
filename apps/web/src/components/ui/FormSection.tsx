import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type FormSectionProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: ReactNode;
};

export function FormSection({
  title,
  description,
  className,
  children,
  ...props
}: FormSectionProps) {
  return (
    <section
      className={cn("space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5", className)}
      {...props}
    >
      <div>
        <h3 className="font-semibold text-slate-950">{title}</h3>
        {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
      </div>
      {children}
    </section>
  );
}
