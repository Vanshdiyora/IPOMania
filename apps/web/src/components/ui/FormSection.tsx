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
      className={cn(
        "space-y-4 rounded-2xl border border-border/90 bg-surface p-4 shadow-card sm:p-5",
        className,
      )}
      {...props}
    >
      <div>
        <h3 className="font-semibold text-navy">{title}</h3>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
      </div>
      {children}
    </section>
  );
}
