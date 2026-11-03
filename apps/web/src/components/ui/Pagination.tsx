import { Button } from "./Button";

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  label = "Pagination",
}: {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  const visiblePages = Array.from({ length: Math.min(3, Math.max(1, totalPages)) }, (_, index) => {
    const start = Math.min(Math.max(page - 1, 1), Math.max(1, totalPages - 2));
    return start + index;
  });
  return (
    <nav
      aria-label={label}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted">
        Page {page} of {Math.max(1, totalPages)}
        {total === undefined ? "" : ` · ${total} records`}
      </p>
      <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 sm:flex">
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
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
