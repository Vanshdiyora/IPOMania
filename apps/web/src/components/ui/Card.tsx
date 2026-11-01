import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type CardProps = HTMLAttributes<HTMLElement> & {
  /** Apply hover lift effect */
  hoverable?: boolean;
  /** Remove default padding */
  noPadding?: boolean;
  /** Make border subtler for nested cards */
  nested?: boolean;
};

export function Card({
  className = "",
  hoverable = false,
  noPadding = false,
  nested = false,
  ...props
}: CardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-surface shadow-card",
        !noPadding && "p-6",
        nested && "border-border bg-canvas shadow-none",
        hoverable && [
          "cursor-pointer transition-all duration-200 ease-smooth",
          "hover:shadow-card-hover hover:-translate-y-0.5",
        ],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-start justify-between gap-4 pb-4", className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-lg font-semibold tracking-tight text-ink", className)} {...props} />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}

export function CardContent({
  className,
  noPadding = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { noPadding?: boolean }) {
  return <div className={cn(!noPadding && "", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-3 border-t border-border pt-4 mt-4", className)}
      {...props}
    />
  );
}
