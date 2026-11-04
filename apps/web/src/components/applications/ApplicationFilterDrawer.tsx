import { FilterDrawer, FilterSection } from "../filters/FilterDrawer";
import { DateRangePicker } from "../filters/DateRangePicker";
import { SearchableSelect, type SearchableSelectOption } from "../filters/SearchableSelect";

export type ApplicationFilters = {
  dematAccountId: string;
  archiveStatus: "active" | "archived" | "all";
  reference: string;
  categoryId: string;
  submissionFrom: string;
  submissionTo: string;
};

type ApplicationFilterDrawerProps = {
  open: boolean;
  filters: ApplicationFilters;
  activeCount: number;
  accountOptions: SearchableSelectOption[];
  categoryOptions: SearchableSelectOption[];
  loading?: {
    accounts?: boolean;
    categories?: boolean;
  };
  onChange: <Key extends keyof ApplicationFilters>(
    key: Key,
    value: ApplicationFilters[Key],
  ) => void;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
};

export function ApplicationFilterDrawer({
  open,
  filters,
  activeCount,
  accountOptions,
  categoryOptions,
  loading = {},
  onChange,
  onClose,
  onReset,
  onApply,
}: ApplicationFilterDrawerProps) {
  const invalidDateRange = Boolean(
    filters.submissionFrom && filters.submissionTo && filters.submissionFrom > filters.submissionTo,
  );
  return (
    <FilterDrawer
      open={open}
      activeCount={activeCount}
      description="Refine your application records."
      onClose={onClose}
      onReset={onReset}
      onApply={onApply}
      applyDisabled={invalidDateRange}
    >
      <div className="space-y-5">
        <FilterSection title="Demat account">
          <SearchableSelect
            label="Account"
            placeholder="All accounts"
            searchPlaceholder="Search accounts..."
            options={accountOptions}
            value={filters.dematAccountId}
            onChange={(value) => onChange("dematAccountId", value as string)}
            loading={loading.accounts}
          />
        </FilterSection>
        <FilterSection title="Archive status">
          <SearchableSelect
            label="Records to show"
            placeholder="Active records"
            options={[
              { value: "active", label: "Active records" },
              { value: "archived", label: "Archived records" },
              { value: "all", label: "All records" },
            ]}
            value={filters.archiveStatus}
            onChange={(value) =>
              onChange("archiveStatus", (value || "active") as ApplicationFilters["archiveStatus"])
            }
          />
        </FilterSection>
        <FilterSection title="Application reference">
          <label className="block text-sm font-semibold text-ink">
            Application number or external reference
            <input
              value={filters.reference}
              onChange={(event) => onChange("reference", event.target.value)}
              placeholder="Search application number or external reference..."
              className="mt-1.5 min-h-touch w-full rounded-lg border border-border bg-white px-3 py-2 text-base text-ink placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
            />
          </label>
        </FilterSection>
        <FilterSection title="Category">
          <SearchableSelect
            label="Category"
            placeholder="All categories"
            options={categoryOptions}
            value={filters.categoryId}
            onChange={(value) => onChange("categoryId", value as string)}
            loading={loading.categories}
          />
        </FilterSection>
        <FilterSection title="Submission date range">
          <DateRangePicker
            from={filters.submissionFrom}
            to={filters.submissionTo}
            onFromChange={(value) => onChange("submissionFrom", value)}
            onToChange={(value) => onChange("submissionTo", value)}
          />
        </FilterSection>
      </div>
    </FilterDrawer>
  );
}
