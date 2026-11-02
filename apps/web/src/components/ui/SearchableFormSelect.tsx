import type { ComponentProps } from "react";
import type { FormSelect } from "./FormControls";
import { SearchableSelect } from "../filters/SearchableSelect";

export function SearchableFormSelect({
  options,
  placeholder = "Choose an option",
  ...props
}: Omit<ComponentProps<typeof FormSelect>, "children" | "onChange"> & {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <SearchableSelect
        label={props.label}
        placeholder={placeholder}
        options={options}
        value={String(props.value ?? "")}
        disabled={props.disabled}
        onChange={(value) => {
          if (!props.onChange) return;
          const nextValue = Array.isArray(value) ? (value[0] ?? "") : value;
          props.onChange(nextValue);
        }}
      />
    </div>
  );
}
