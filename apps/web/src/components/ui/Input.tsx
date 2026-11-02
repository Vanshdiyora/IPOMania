import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";
import { SearchableSelect } from "../filters/SearchableSelect";
import { DateTimeInput } from "./DateTimeInput";

// ─── Base input class ─────────────────────────────────────────────────────────
const inputBase = [
  "min-w-0 max-w-full w-full rounded-xl border border-border bg-surface shadow-sm shadow-indigo-950/[0.02]",
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
  { className, inputSize = "md", type, ...props },
  ref,
) {
  const styledClassName = cn(inputBase, inputSizeClass[inputSize], className);
  if (type === "date") {
    return <DateTimeInput {...props} ref={ref} type="date" className={styledClassName} />;
  }
  if (type === "datetime-local") {
    return <DateTimeInput {...props} ref={ref} type="datetime-local" className={styledClassName} />;
  }
  return <input ref={ref} type={type} className={styledClassName} {...props} />;
});

// ─── Select ───────────────────────────────────────────────────────────────────
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  inputSize?: keyof typeof inputSizeClass;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    className,
    inputSize = "md",
    children,
    value,
    defaultValue,
    onChange,
    onBlur,
    multiple,
    required,
    disabled,
    name,
    id,
    "aria-label": ariaLabel,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedby,
    ...nativeProps
  },
  ref,
) {
  const nativeRef = useRef<HTMLSelectElement>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(() => {
    if (Array.isArray(defaultValue)) return defaultValue.map(String);
    return String(defaultValue ?? "");
  });
  useImperativeHandle(ref, () => {
    if (!nativeRef.current) throw new Error("The custom dropdown ref is not mounted.");
    return nativeRef.current;
  }, []);
  const options: Array<{ value: string; label: string; disabled?: boolean }> = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const option = child.props as {
      value?: string | number;
      label?: string;
      children?: ReactNode;
      disabled?: boolean;
    };
    const optionLabel =
      option.label ??
      (typeof option.children === "string" ? option.children : String(option.children ?? ""));
    options.push({
      value: String(option.value ?? optionLabel),
      label: optionLabel,
      disabled: option.disabled,
    });
  });
  const currentValue = Array.isArray(value)
    ? value.map(String)
    : value === undefined
      ? (nativeRef.current?.value ?? uncontrolledValue)
      : String(value ?? "");
  const placeholder = options.find((option) => option.value === "")?.label ?? "Choose an option";
  const selectValue = (nextValue: string | string[]) => {
    const element = nativeRef.current;
    if (!element) return;
    if (Array.isArray(nextValue)) {
      for (const option of element.options) option.selected = nextValue.includes(option.value);
    } else {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        "value",
      )?.set;
      if (!valueSetter) throw new Error("The custom dropdown could not update its selected value.");
      valueSetter.call(element, nextValue);
    }
    element.dispatchEvent(new Event("change", { bubbles: true }));
    setUncontrolledValue(nextValue);
  };
  useEffect(() => {
    if (value !== undefined || defaultValue !== undefined || !nativeRef.current) return;
    setUncontrolledValue(nativeRef.current.value);
  }, [defaultValue, value]);

  return (
    <>
      <SearchableSelect
        label={ariaLabel ?? ""}
        placeholder={placeholder}
        options={options.filter((option) => option.value !== "")}
        value={currentValue}
        multiple={multiple}
        disabled={disabled}
        hideLabel
        triggerId={id}
        triggerClassName={cn(
          inputBase,
          inputSizeClass[inputSize],
          "cursor-pointer text-left",
          className,
        )}
        ariaInvalid={ariaInvalid === true || ariaInvalid === "true"}
        ariaRequired={required}
        ariaDescribedby={ariaDescribedby}
        onTriggerBlur={() => {
          if (!onBlur || !nativeRef.current) return;
          nativeRef.current.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
        }}
        onChange={selectValue}
      />
      <select
        ref={nativeRef}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={currentValue}
        multiple={multiple}
        disabled={disabled}
        onChange={onChange}
        onBlur={onBlur}
        {...nativeProps}
      >
        {children}
      </select>
    </>
  );
});

// ─── Textarea ─────────────────────────────────────────────────────────────────
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(inputBase, "min-h-24 resize-y py-2.5", className)}
      {...props}
    />
  );
});

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
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
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
        className={cn(inputBase, inputSizeClass.md, "pl-9", value && onClear ? "pr-12" : "")}
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          className="absolute right-0 top-1/2 inline-flex min-h-touch min-w-touch -translate-y-1/2 items-center justify-center rounded text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus"
          onClick={onClear}
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
