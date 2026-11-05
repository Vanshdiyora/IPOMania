import { useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { paginationPageSizes } from "@ipo-mania/validation";
import { Button } from "./Button";
import { Select as CustomSelect } from "./Input";

type PageItem = number | "start-ellipsis" | "end-ellipsis";

function getVisiblePages(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (page <= 3) return [1, 2, 3, 4, "end-ellipsis", totalPages];
  if (page >= totalPages - 2)
    return [1, "start-ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "start-ellipsis", page - 1, page, page + 1, "end-ellipsis", totalPages];
}

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
  const currentPage = Math.max(1, Math.min(page, resolvedTotalPages));

  useEffect(() => {
    if (page !== currentPage) onPageChange(currentPage);
  }, [page, currentPage, onPageChange]);

  const visiblePages = getVisiblePages(currentPage, resolvedTotalPages);
  const firstRecord =
    total === undefined || total === 0 || pageSize === undefined
      ? 0
      : (currentPage - 1) * pageSize + 1;
  const lastRecord =
    total === undefined || total === 0
      ? 0
      : pageSize === undefined
        ? total
        : Math.min(currentPage * pageSize, total);
  const pageSummary = (
    <>
      Page <span className="font-semibold tabular text-ink">{currentPage}</span> of{" "}
      <span className="font-semibold tabular text-ink">{resolvedTotalPages}</span>
    </>
  );

  return (
    <nav
      aria-label={label}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <p className="text-sm text-muted">
          {total === undefined ? (
            pageSummary
          ) : pageSize === undefined ? (
            <>
              <span className="font-semibold tabular text-ink">{total}</span> records
              <span className="ml-2 whitespace-nowrap text-subtle">· {pageSummary}</span>
            </>
          ) : (
            <>
              Showing{" "}
              <span className="font-semibold tabular text-ink">
                {firstRecord}–{lastRecord}
              </span>{" "}
              of <span className="font-semibold tabular text-ink">{total}</span> records
              <span className="ml-2 whitespace-nowrap text-subtle">· {pageSummary}</span>
            </>
          )}
        </p>
        {pageSize !== undefined && onPageSizeChange ? (
          <label className="flex min-h-touch items-center gap-2 text-sm text-muted">
            <span className="whitespace-nowrap">Records per page</span>
            <CustomSelect
              aria-label="Records per page"
              className="w-24 rounded-xl"
              inputSize="sm"
              value={String(pageSize)}
              searchable={false}
              clearable={false}
              showSelectedIndicator={false}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {paginationPageSizes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </CustomSelect>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
        {resolvedTotalPages > 5 ? (
          <Button
            variant="outline"
            size="icon"
            aria-label="First page"
            title="First page"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeft className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="rounded-xl px-3 sm:px-4"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </Button>

        <div className="flex items-center gap-1 rounded-xl bg-canvas p-1">
          {visiblePages.map((visiblePage) =>
            typeof visiblePage === "number" ? (
              <Button
                key={visiblePage}
                variant={visiblePage === currentPage ? "default" : "ghost"}
                size="icon"
                className="rounded-lg"
                aria-label={`Page ${visiblePage}`}
                aria-current={visiblePage === currentPage ? "page" : undefined}
                onClick={() => onPageChange(visiblePage)}
              >
                {visiblePage}
              </Button>
            ) : (
              <span
                key={visiblePage}
                aria-hidden="true"
                className="px-1 text-sm font-medium text-muted"
              >
                …
              </span>
            ),
          )}
        </div>

        <Button
          variant="outline"
          className="rounded-xl px-3 sm:px-4"
          disabled={currentPage >= resolvedTotalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
        {resolvedTotalPages > 5 ? (
          <Button
            variant="outline"
            size="icon"
            aria-label="Last page"
            title="Last page"
            disabled={currentPage >= resolvedTotalPages}
            onClick={() => onPageChange(resolvedTotalPages)}
          >
            <ChevronsRight className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
