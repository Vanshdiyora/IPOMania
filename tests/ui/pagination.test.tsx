// @vitest-environment jsdom

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "../../apps/web/src/components/ui/Pagination";

describe("pagination controls", () => {
  it("moves an out-of-range page to the last available page", async () => {
    const onPageChange = vi.fn();

    render(<Pagination page={4} totalPages={2} onPageChange={onPageChange} />);

    await waitFor(() => expect(onPageChange).toHaveBeenCalledWith(2));
  });

  it("shows page context without claiming a record range when page size is omitted", () => {
    render(<Pagination page={2} totalPages={4} total={27} onPageChange={() => undefined} />);

    expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveTextContent(
      /27 records\s*·\s*Page 2 of 4/,
    );
  });

  it("shows a record range and changes page and page size with the shared dropdown", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <Pagination
        page={4}
        totalPages={12}
        total={182}
        pageSize={10}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    expect(screen.getByText(/Showing/)).toHaveTextContent(
      /Showing\s+31\s*–\s*40\s+of\s+182\s+records/,
    );
    expect(screen.getByRole("button", { name: "Page 4" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getAllByText("…")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(5);

    const pageSize = screen.getByRole("combobox", { name: "Records per page" });
    expect(pageSize).toHaveClass("w-24");
    await user.click(pageSize);
    const pageSizeOption = screen.getByRole("option", { name: "10" });
    expect(pageSizeOption.querySelector("[data-select-checkbox]")).toBeNull();
    expect(pageSizeOption).toHaveAttribute("aria-selected", "true");
    expect(pageSizeOption).toHaveClass("bg-indigo-50");
    expect(pageSizeOption.querySelector("svg")).toBeNull();
    await user.click(pageSizeOption);
    expect(onPageSizeChange).toHaveBeenCalledWith(10);
  });
});
