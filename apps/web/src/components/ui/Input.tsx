import { forwardRef } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

// ─── Base input class ─────────────────────────────────────────────────────────
const inputBase = [
  "w-full rounded-lg border border-border bg-surface",
  "px-3 py-2 text-base text-ink placeholder:text-subtle",
  "transition-colors duration-150",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-border-focus focus-visible:border-border-focus",
  "disabled:pointer-events-none disabled:opacity-50 disabled:bg-canvas",
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:outline-danger",
].join(" ");

const inputSizeClass = {
  sm: "min-h-8 text-sm px-2.5 py-1.5",
  md: "min-h-touch",
  lg: "min-h-12 text-lg px-4 py-3",
};

// ─── Text/Email/Password/Date Input ──────────────────────────────────────────
type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  inputSize?: keyof typeof inputSizeClass;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, inputSize = "md", ...props },
  ref,
) {
  return (
    <input ref={ref} className={cn(inputBase, inputSizeClass[inputSize], className)} {...props} />
  );
});

// ─── Select ───────────────────────────────────────────────────────────────────
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  inputSize?: keyof typeof inputSizeClass;
};

export function Select({ className, inputSize = "md", ...props }: SelectProps) {
  return (
    <select
      className={cn(
        inputBase,
        inputSizeClass[inputSize],
        "cursor-pointer appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[position:right_10px_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    />
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn(inputBase, "min-h-24 resize-y py-2.5", className)} {...props} />;
}

// ─── FormField wrapper ────────────────────────────────────────────────────────
interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Search Input ─────────────────────────────────────────────────────────────
import { Search, X } from "lucide-react";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  onClear?: () => void;
}

export function SearchInput({ className, onClear, value, ...props }: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        size={16}
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        className={cn(inputBase, inputSizeClass.md, "pl-9", value && onClear ? "pr-9" : "")}
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus"
          onClick={onClear}
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
