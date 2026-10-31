import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeStyles = cva(
  [
    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5",
    "text-xs font-semibold tracking-wide",
    "transition-colors duration-150",
  ],
  {
    variants: {
      variant: {
        default: "bg-surface-subtle text-ink border border-border",
        primary: "bg-action-light text-action border border-action-border",
        success: "bg-success-bg text-success border border-success-border",
        warning: "bg-warning-bg text-warning border border-warning-border",
        danger: "bg-danger-bg text-danger border border-danger-border",
        info: "bg-info-bg text-info border border-info-border",
        navy: "bg-navy text-white border border-navy",
        outline: "border border-border-strong text-muted bg-transparent",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-0.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeStyles> & {
    dot?: boolean;
  };

export function Badge({ className, variant, size, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeStyles({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "success" && "bg-success",
            variant === "warning" && "bg-warning",
            variant === "danger" && "bg-danger",
            variant === "primary" && "bg-action",
            variant === "info" && "bg-info",
            (!variant || variant === "default") && "bg-muted",
            variant === "navy" && "bg-white",
            variant === "outline" && "bg-muted",
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

/** Specialized IPO status badge */
export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/_/g, "-");

  const variantMap: Record<string, VariantProps<typeof badgeStyles>["variant"]> = {
    open: "success",
    upcoming: "info",
    listed: "primary",
    closed: "default",
    withdrawn: "danger",
    "allotment-pending": "warning",
    allotted: "success",
    applied: "primary",
    pending: "warning",
    rejected: "danger",
    active: "success",
    inactive: "default",
    archived: "outline",
  };

  const variant = variantMap[normalized] ?? "default";
  const label = status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}
