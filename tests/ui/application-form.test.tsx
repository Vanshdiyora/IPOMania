// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type * as ApiModule from "../../apps/web/src/lib/api";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";
import { ApplicationFormPage } from "../../apps/web/src/pages/applications/ApplicationPages";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => ({ session: { access_token: "regular-user-token" } }),
}));
vi.mock("../../apps/web/src/components/ui/FormDrawer", () => ({
  RouteFormDrawer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerRouteLink: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("../../apps/web/src/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiRequest: apiRequestMock,
}));

function renderForm(initialEntry = "/applications/new") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ToastProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <ApplicationFormPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

async function chooseIpo(name: string) {
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "IPO" })).not.toHaveAttribute("aria-busy", "true"),
  );
  fireEvent.click(screen.getByRole("combobox", { name: "IPO" }));
  fireEvent.click(await screen.findByRole("option", { name }));
}

describe("application form IPO selection", () => {
  it("preselects an imported shared IPO and shows its copied category rules", async () => {
    const ipoId = "88888888-8888-4888-8888-888888888888";
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/ipos/catalog?")) {
        return { data: { ipos: [], pagination: { page: 1, total_pages: 1 } } };
      }
      if (path.startsWith("/api/ipos?")) {
        return {
          data: {
            ipos: [{ id: ipoId, company_name: "Imported Catalog IPO", status: "OPEN" }],
            pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
          },
        };
      }
      if (path === `/api/ipos/${ipoId}`) {
        return { data: { id: ipoId, company_name: "Imported Catalog IPO" } };
      }
      if (path.startsWith("/api/accounts?")) {
        return {
          data: {
            accounts: [],
            pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
          },
        };
      }
      if (path === `/api/ipos/${ipoId}/categories`) {
        return {
          data: {
            configurations: [
              {
                id: "copied-retail-rule",
                category: "RETAIL",
                rule_version: 1,
                default_lots: 1,
              },
            ],
          },
        };
      }
      throw new Error("Unexpected request: " + path);
    });

    renderForm(`/applications/new?ipo_id=${ipoId}`);

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "IPO" })).toHaveTextContent(
        "Imported Catalog IPO",
      ),
    );
    const categorySelect = await screen.findByRole("combobox", { name: "Investor category" });
    await waitFor(() => expect(categorySelect).not.toBeDisabled());
    fireEvent.click(categorySelect);
    expect(await screen.findByRole("option", { name: /Retail — .*rules v1/ })).toBeInTheDocument();
  });

  it("explains how to add an IPO to the catalog when no options are returned", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/ipos/catalog?")) {
        return { data: { ipos: [], pagination: { page: 1, total_pages: 1 } } };
      }
      if (path.startsWith("/api/ipos?")) {
        return {
          data: {
            ipos: [],
            pagination: { page: 1, page_size: 25, total: 0, total_pages: 0 },
          },
        };
      }
      if (path.startsWith("/api/accounts?")) {
        return {
          data: {
            accounts: [],
            pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
          },
        };
      }
      throw new Error("Unexpected request: " + path);
    });

    renderForm();

    const addIpoLink = await screen.findByRole("link", { name: "Add to catalog" });
    expect(addIpoLink).toHaveAttribute("href", "/ipos/new");
    expect(addIpoLink.parentElement).toHaveTextContent(
      "No IPOs are available in your records or the shared catalog. Add to catalog and configure its category before recording an application.",
    );
  });

  it("uses shared catalog IPO data locally when the user selects an IPO", async () => {
    const catalogIpoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/ipos?")) {
        return {
          data: {
            ipos: [],
            pagination: { page: 1, page_size: 25, total: 0, total_pages: 0 },
          },
        };
      }
      if (path.startsWith("/api/ipos/catalog?")) {
        return {
          data: {
            ipos: [
              {
                id: catalogIpoId,
                company_name: "Shared Catalog IPO",
                status: "OPEN",
                symbol: "SHARED",
                exchange: "NSE",
                issue_price_min: "100",
                issue_price_max: "110",
                lot_size: 10,
                issue_size: "100000",
                opening_date: "2026-11-01",
                closing_date: "2026-11-03",
              },
            ],
            pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
          },
        };
      }
      if (path === `/api/ipos/catalog/${catalogIpoId}/categories`) {
        return { data: { configurations: [] } };
      }
      if (path.startsWith("/api/accounts?")) {
        return {
          data: {
            accounts: [],
            pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
          },
        };
      }
      throw new Error("Unexpected request: " + path);
    });

    renderForm();

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "IPO" })).not.toHaveAttribute(
        "aria-busy",
        "true",
      ),
    );
    fireEvent.click(screen.getByRole("combobox", { name: "IPO" }));
    fireEvent.click(await screen.findByRole("option", { name: /Shared Catalog IPO/ }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        `/api/ipos/catalog/${catalogIpoId}/categories`,
        expect.anything(),
      ),
    );
    expect(screen.getByRole("textbox", { name: /Price/ })).toHaveValue("110");
    expect(screen.getByText("Total amount: ₹1100")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: /Lots/ }), { target: { value: "2" } });
    expect(screen.getByText("Total amount: ₹2200")).toBeInTheDocument();
    expect(screen.getByText("Total shares: 20")).toBeInTheDocument();
    expect(apiRequestMock).not.toHaveBeenCalledWith(
      `/api/ipos/catalog/${catalogIpoId}/import`,
      expect.anything(),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows incomplete shared IPOs as unavailable instead of attempting an import", async () => {
    const catalogIpoId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/ipos?")) {
        return {
          data: {
            ipos: [],
            pagination: { page: 1, page_size: 25, total: 0, total_pages: 0 },
          },
        };
      }
      if (path.startsWith("/api/ipos/catalog?")) {
        return {
          data: {
            ipos: [
              {
                id: catalogIpoId,
                company_name: "Incomplete Catalog IPO",
                status: "UPCOMING",
                symbol: null,
                exchange: null,
                issue_price_min: null,
                issue_price_max: null,
                lot_size: null,
                issue_size: null,
                opening_date: null,
                closing_date: null,
              },
            ],
            pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
          },
        };
      }
      if (path.startsWith("/api/accounts?")) {
        return {
          data: {
            accounts: [],
            pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
          },
        };
      }
      throw new Error("Unexpected request: " + path);
    });

    renderForm();

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "IPO" })).not.toHaveAttribute(
        "aria-busy",
        "true",
      ),
    );
    fireEvent.click(screen.getByRole("combobox", { name: "IPO" }));

    const option = await screen.findByRole("option", { name: /Incomplete Catalog IPO/ });
    expect(option).toBeDisabled();
    expect(option).toHaveTextContent("Issue data incomplete");
    fireEvent.click(option);
    expect(apiRequestMock).not.toHaveBeenCalledWith(
      `/api/ipos/catalog/${catalogIpoId}/import`,
      expect.anything(),
      expect.anything(),
    );
  });

  it("links to category setup when the selected IPO has no configured rules", async () => {
    const ipoId = "88888888-8888-4888-8888-888888888888";
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/ipos/catalog?")) {
        return { data: { ipos: [], pagination: { page: 1, total_pages: 1 } } };
      }
      if (path.startsWith("/api/ipos?")) {
        return {
          data: {
            ipos: [{ id: ipoId, company_name: "Category Test IPO", status: "OPEN" }],
            pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
          },
        };
      }
      if (path.startsWith("/api/accounts?")) {
        return {
          data: {
            accounts: [],
            pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
          },
        };
      }
      if (path === `/api/ipos/${ipoId}/categories`) return { data: { configurations: [] } };
      throw new Error("Unexpected request: " + path);
    });

    renderForm();

    await chooseIpo("Category Test IPO");

    const setupLink = await screen.findByRole("link", { name: "Configure categories" });
    expect(setupLink).toHaveAttribute("href", `/ipos/${ipoId}/categories`);
    expect(setupLink.parentElement).toHaveTextContent(
      "No category rules are configured for this IPO.",
    );

    const categorySelect = screen.getByRole("combobox", { name: "Investor category" });
    fireEvent.click(categorySelect);
    const categoryOptions = [
      /Retail — .*not configured for this IPO/,
      /sHNI — .*not configured for this IPO/,
      /bHNI — .*not configured for this IPO/,
      /Shareholder — .*not configured for this IPO/,
    ];
    const options = categoryOptions.map((name) => screen.getByRole("option", { name }));
    options.forEach((option) => expect(option).toBeEnabled());
    const shniOption = options[1];
    if (!shniOption) throw new Error("The sHNI category option was not rendered.");
    fireEvent.click(shniOption);

    expect(
      screen.getByText(/Small HNI; limits follow the IPO configuration/, { selector: "p" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Category selected for reference/)).toBeInTheDocument();
  });

  it("shows only the latest rule version for each category", async () => {
    const ipoId = "88888888-8888-4888-8888-888888888888";
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/ipos/catalog?")) {
        return { data: { ipos: [], pagination: { page: 1, total_pages: 1 } } };
      }
      if (path.startsWith("/api/ipos?")) {
        return {
          data: {
            ipos: [{ id: ipoId, company_name: "Versioned IPO", status: "OPEN" }],
            pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
          },
        };
      }
      if (path.startsWith("/api/accounts?")) {
        return {
          data: {
            accounts: [],
            pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
          },
        };
      }
      if (path === `/api/ipos/${ipoId}/categories`) {
        return {
          data: {
            configurations: [
              { id: "first-rule", category: "RETAIL", rule_version: 1, default_lots: 1 },
              { id: "current-rule", category: "RETAIL", rule_version: 2, default_lots: 2 },
              { id: "hni-rule", category: "SHNI", rule_version: 1, default_lots: 3 },
            ],
          },
        };
      }
      throw new Error("Unexpected request: " + path);
    });

    renderForm();

    await chooseIpo("Versioned IPO");

    fireEvent.click(await screen.findByRole("combobox", { name: "Investor category" }));
    expect(await screen.findByRole("option", { name: /Retail — .*rules v2/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Retail — .*rules v1/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /sHNI — .*rules v1/ })).toBeInTheDocument();
  });

  it("uses the category initial lots and shows the share count from the IPO lot size", async () => {
    const ipoId = "88888888-8888-4888-8888-888888888888";
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/ipos/catalog?")) {
        return { data: { ipos: [], pagination: { page: 1, total_pages: 1 } } };
      }
      if (path === `/api/ipos/${ipoId}`) {
        return { data: { id: ipoId, company_name: "Lot Size IPO", lot_size: 25 } };
      }
      if (path.startsWith("/api/ipos?")) {
        return {
          data: {
            ipos: [
              {
                id: ipoId,
                company_name: "Lot Size IPO",
                status: "OPEN",
                lot_size: 25,
              },
            ],
            pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
          },
        };
      }
      if (path.startsWith("/api/accounts?")) {
        return {
          data: {
            accounts: [],
            pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
          },
        };
      }
      if (path === `/api/ipos/${ipoId}/categories`) {
        return {
          data: {
            configurations: [
              {
                id: "retail-rule",
                category: "RETAIL",
                rule_version: 1,
                default_lots: 3,
                allowed_price_types: ["BID"],
              },
            ],
          },
        };
      }
      throw new Error("Unexpected request: " + path);
    });

    const { container } = renderForm(`/applications/new?ipo_id=${ipoId}`);
    await waitFor(() =>
      expect(container.querySelector('option[value="retail-rule"]')).not.toBeNull(),
    );
    const categorySelect = container
      .querySelector<HTMLOptionElement>('option[value="retail-rule"]')
      ?.closest("select");
    if (!categorySelect) throw new Error("The category selector was not rendered.");
    fireEvent.change(categorySelect, { target: { value: "retail-rule" } });

    expect(screen.getByRole("spinbutton", { name: "Lots" })).toHaveValue(3);
    expect(
      screen.getByText("One lot contains 25 shares. 3 lot(s) = 75 shares."),
    ).toBeInTheDocument();
  });
});
