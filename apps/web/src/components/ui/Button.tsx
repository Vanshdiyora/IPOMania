import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonStyles = cva(
  "inline-flex min-h-touch items-center justify-center rounded-lg px-5 py-2 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-action text-white hover:bg-navy",
        secondary: "bg-[#EAF0F6] text-navy hover:bg-[#DCE6F0]",
        outline: "border border-border bg-white text-ink hover:bg-canvas",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>;

export function Button({ className, type = "button", variant, ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonStyles({ variant }), className)} {...props} />;
}
