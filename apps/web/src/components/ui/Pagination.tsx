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
  const visiblePages = Array.from({ length: Math.min(5, Math.max(1, totalPages)) }, (_, index) => {
    const start = Math.min(Math.max(page - 2, 1), Math.max(1, totalPages - 4));
    return start + index;
  });
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        Page {page} of {Math.max(1, totalPages)}
        {total === undefined ? "" : ` · ${total} records`}
      </p>
      <div className="flex gap-2">
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
