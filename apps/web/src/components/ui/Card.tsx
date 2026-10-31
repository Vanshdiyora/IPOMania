import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-border bg-white p-6 shadow-sm ${className}`}
      {...props}
    />
  );
}
