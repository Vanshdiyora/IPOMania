// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "../../apps/web/src/lib/api";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";
import { ApplicationDashboardPage } from "../../apps/web/src/pages/applications/ApplicationPages";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => ({ session: { access_token: "regular-user-token" } }),
}));
vi.mock("../../apps/web/src/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiRequest: apiRequestMock,
}));

const ipoId = "88888888-8888-4888-8888-888888888888";
const allIpoSummary = {
  data: {
    total: 23,
    distinct_ipo_count: 23,
    category_counts: { RETAIL: 12, SHNI: 5, BHNI: 4, SHAREHOLDER: 2 },
  },
};

function renderPage(path = "/applications") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ToastProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <ApplicationDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

describe("application manager overview", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/api/applications/summary") return allIpoSummary;
      if (path === `/api/applications/summary?ipo_id=${ipoId}`) {
        return {
          data: {
            total: 3,
            distinct_ipo_count: 1,
            category_counts: { RETAIL: 1, SHNI: 1, BHNI: 0, SHAREHOLDER: 1 },
          },
        };
      }
      if (path.startsWith("/api/applications?")) {
        return {
          data: {
            applications: [],
            pagination: { page: 1, page_size: 50, total: 0, total_pages: 1 },
          },
        };
      }
      if (path.startsWith("/api/ipos?")) {
        return {
          data: {
            ipos: [{ id: ipoId, company_name: "Example Industries", status: "OPEN" }],
            pagination: { page: 1, total_pages: 1 },
          },
        };
      }
      if (path.startsWith("/api/accounts?")) {
        return { data: { accounts: [], pagination: { page: 1, totalPages: 1 } } };
      }
      if (path === `/api/ipos/${ipoId}/categories`) return { data: { configurations: [] } };
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it("shows all-IPO category totals and scopes metrics and the table through the IPO selector", async () => {
    const overview = renderPage();

    expect(await screen.findByText("Retail", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("12", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("23 different IPOs applied")).toBeInTheDocument();
    expect(screen.queryByText("Status", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText(/Set application status/i)).not.toBeInTheDocument();

    const ipoSelector = screen.getByRole("combobox", { name: "View applications for IPO" });
    await waitFor(() => expect(ipoSelector).not.toBeDisabled());
    expect(ipoSelector).toHaveTextContent("All IPOs");
    fireEvent.click(ipoSelector);
    fireEvent.click(await screen.findByRole("option", { name: /Example Industries/ }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        `/api/applications/summary?ipo_id=${ipoId}`,
        expect.anything(),
      ),
    );
    expect(screen.getByRole("combobox", { name: "View applications for IPO" })).toHaveTextContent(
      "Example Industries",
    );
    expect(screen.getByLabelText("Application totals")).toHaveTextContent(
      "Retail1sHNI1bHNI0Shareholder1",
    );
    expect(screen.getByText("23 different IPOs applied")).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/applications\?.*ipo_id=88888888-8888-4888-8888-888888888888/),
      expect.anything(),
    );
    overview.unmount();
  });
});
