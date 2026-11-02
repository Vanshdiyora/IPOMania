import { useState, type ComponentProps } from "react";
import { FormSelect } from "./FormControls";
import { SearchInput } from "./Input";

// Retain a native select for touch and keyboard support; large option lists gain
// a search field without dropping the current selection when a query changes.
export function SearchableFormSelect({
  options,
  placeholder = "Choose an option",
  ...props
}: Omit<ComponentProps<typeof FormSelect>, "children"> & {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = options.filter(
    (option) =>
      option.value === props.value ||
      option.label.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <div className="min-w-0 space-y-2">
      {options.length > 8 && (
        <SearchInput
          aria-label={`Search ${props.label.toLowerCase()} options`}
          placeholder={`Search ${props.label.toLowerCase()}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          disabled={props.disabled}
        />
      )}
      <FormSelect {...props}>
        <option value="">{placeholder}</option>
        {filtered.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FormSelect>
      {search && !filtered.length && (
        <p role="status" className="text-xs text-muted">
          No matching options.
        </p>
      )}
    </div>
  );
}
