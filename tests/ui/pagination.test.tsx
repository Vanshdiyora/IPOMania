// @vitest-environment jsdom

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "../../apps/web/src/components/ui/Pagination";

describe("pagination controls", () => {
  it("moves an out-of-range page to the last available page", async () => {
    const onPageChange = vi.fn();

    render(<Pagination page={4} totalPages={2} onPageChange={onPageChange} />);

    await waitFor(() => expect(onPageChange).toHaveBeenCalledWith(2));
  });
});
