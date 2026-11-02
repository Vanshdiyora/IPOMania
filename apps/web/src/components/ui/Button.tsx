import { cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactElement } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "../../lib/utils";

const buttonStyles = cva(
  [
    "inline-flex min-h-touch items-center justify-center gap-2 rounded-lg px-5 py-2",
    "text-base font-semibold tracking-tight",
    "transition-all duration-150 ease-smooth",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
    "disabled:pointer-events-none disabled:border disabled:border-border disabled:bg-surface-subtle disabled:text-muted disabled:shadow-none",
    "select-none",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-action text-white shadow-button",
          "hover:bg-action-hover hover:shadow-md",
          "active:scale-[0.98]",
        ],
        secondary: [
          "bg-action-light text-action border border-action-border",
          "hover:bg-blue-100 hover:border-action",
          "active:scale-[0.98]",
        ],
        outline: [
          "border border-border bg-surface text-ink",
          "hover:bg-canvas hover:border-border-strong",
          "active:scale-[0.98]",
        ],
        ghost: ["text-muted", "hover:bg-surface-subtle hover:text-ink", "active:scale-[0.98]"],
        danger: ["bg-danger text-white shadow-button", "hover:bg-red-700", "active:scale-[0.98]"],
        "danger-outline": [
          "border border-danger-border bg-danger-bg text-danger",
          "hover:bg-red-100 hover:border-danger",
          "active:scale-[0.98]",
        ],
      },
      size: {
        sm: "min-h-8 px-3 py-1 text-sm",
        md: "min-h-touch px-5 py-2 text-base",
        lg: "min-h-12 px-6 py-3 text-base",
        icon: "min-h-touch min-w-touch p-0 px-0",
        "icon-sm": "h-8 w-8 min-h-8 min-w-8 p-0 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & {
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({
  className,
  type = "button",
  variant,
  size,
  asChild = false,
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, {
      className: cn(buttonStyles({ variant, size }), child.props.className, className),
    });
  }

  return (
    <button
      type={type}
      className={cn(buttonStyles({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
