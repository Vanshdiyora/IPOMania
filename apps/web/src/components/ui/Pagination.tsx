import { useEffect } from "react";
import { paginationPageSizes } from "@ipo-mania/validation";
import { Button } from "./Button";
import { Select as CustomSelect } from "./Input";

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  label = "Pagination",
}: {
  page: number;
  totalPages: number;
  total?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  label?: string;
}) {
  const resolvedTotalPages = Math.max(1, totalPages);

  useEffect(() => {
    if (page > resolvedTotalPages) onPageChange(resolvedTotalPages);
  }, [page, resolvedTotalPages, onPageChange]);

  const visiblePages = Array.from({ length: Math.min(3, resolvedTotalPages) }, (_, index) => {
    const start = Math.min(Math.max(page - 1, 1), Math.max(1, resolvedTotalPages - 2));
    return start + index;
  });
  return (
    <nav
      aria-label={label}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted">
        Page {Math.min(page, resolvedTotalPages)} of {resolvedTotalPages}
        {total === undefined ? "" : ` · ${total} records`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {pageSize !== undefined && onPageSizeChange && (
          <label className="flex min-h-touch items-center gap-2 text-sm text-muted">
            Records per page
            <CustomSelect
              aria-label="Records per page"
              className="w-24"
              value={String(pageSize)}
              searchable={false}
              clearable={false}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {paginationPageSizes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </CustomSelect>
          </label>
        )}
        <Button variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        {visiblePages.map((visiblePage) => (
          <Button
            key={visiblePage}
            variant={visiblePage === page ? "default" : "outline"}
            aria-current={visiblePage === page ? "page" : undefined}
            onClick={() => onPageChange(visiblePage)}
          >
            {visiblePage}
          </Button>
        ))}
        <Button
          variant="outline"
          disabled={page >= resolvedTotalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
