// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "../../apps/web/src/lib/api";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";
import {
  IpoCatalogApplicationsPage,
  IpoCatalogDetailsPage,
  IpoCategoryConfigurationPage,
  IpoDetailsPage,
  IpoListPage,
} from "../../apps/web/src/pages/ipos/IpoPages";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => ({ session: { access_token: "regular-user-token" } }),
}));
vi.mock("../../apps/web/src/components/ui/FormDrawer", () => ({
  RouteFormDrawer: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  DrawerRouteLink: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("../../apps/web/src/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiRequest: apiRequestMock,
}));

const catalogIpo = {
  id: "88888888-8888-4888-8888-888888888888",
  company_name: "Admin Catalog Test Company",
  symbol: null,
  exchange: null,
  ipo_type: "MAINBOARD",
  issue_price_min: null,
  issue_price_max: null,
  cut_off_price: null,
  issue_size: null,
  lot_size: null,
  opening_date: null,
  closing_date: null,
  allotment_date: null,
  listing_date: null,
  last_verified_at: null,
  source_reference: null,
  status: "UPCOMING",
  data_source: "IPO_GURU",
};

function listResponse(ipos = [catalogIpo], page = 1, totalPages = 1) {
  return {
    data: {
      ipos,
      pagination: { page, page_size: 25, total: totalPages * 25, total_pages: totalPages },
    },
  };
}

function renderPage(path = "/ipos") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ToastProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/ipos" element={<IpoListPage />} />
            <Route path="/ipo-calendar" element={<Navigate to="/ipos" replace />} />
            <Route path="/ipos/:ipoId" element={<IpoDetailsPage />} />
            <Route
              path="/ipos/catalog/:ipoId/applications"
              element={<IpoCatalogApplicationsPage />}
            />
            <Route path="/ipos/catalog/:ipoId" element={<IpoCatalogDetailsPage />} />
            <Route
              path="/admin/ipos/:ipoId/categories"
              element={<IpoCategoryConfigurationPage sharedCatalog />}
            />
            <Route path="/applications/new" element={<p>Application form</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

describe("user IPO catalog", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("loads shared IPOs by default and displays missing table values as dashes", async () => {
    apiRequestMock.mockResolvedValue(listResponse());
    renderPage();
    const link = await screen.findByRole("link", { name: catalogIpo.company_name });
    expect(link).toHaveAttribute("href", `/ipos/catalog/${catalogIpo.id}`);
    expect(screen.queryByRole("button", { name: "My IPOs" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add to catalog" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Source" })).not.toBeInTheDocument();
    expect(screen.queryByText("Admin-managed", { exact: true })).not.toBeInTheDocument();
    expect(screen.getAllByText("-")).toHaveLength(3);
    expect(screen.queryByText("-", { selector: "td p" })).not.toBeInTheDocument();
    expect(screen.getByText("- – -")).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/ipos/catalog?page=1&page_size=10&sort=date_desc",
      expect.anything(),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("ignores the legacy personal source and only shows the shared catalog", async () => {
    const ownedIpo = {
      ...catalogIpo,
      id: "99999999-9999-4999-8999-999999999999",
      company_name: "My Private IPO",
      symbol: "PRIVATE",
      exchange: "NSE",
      status: "OPEN",
      data_source: "MANUAL",
    };
    apiRequestMock.mockImplementation(async (path: string) =>
      path.startsWith("/api/ipos?") ? listResponse([ownedIpo]) : listResponse([catalogIpo]),
    );

    renderPage("/ipos?source=personal");

    expect(await screen.findByRole("link", { name: catalogIpo.company_name })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Private IPO" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "My IPOs" })).not.toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/ipos/catalog?page=1&page_size=10&sort=date_desc",
      expect.anything(),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    expect(apiRequestMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/ipos\?/),
      expect.anything(),
    );
  });

  it("keeps pagination and supports multi-status filtering, sorting, and search", async () => {
    apiRequestMock.mockResolvedValue(
      listResponse(
        [
          catalogIpo,
          {
            ...catalogIpo,
            id: "99999999-9999-4999-8999-999999999999",
            company_name: "Closed Test Company",
            status: "CLOSED",
          },
        ],
        1,
        2,
      ),
    );
    renderPage();
    await screen.findByRole("link", { name: catalogIpo.company_name });
    expect(screen.getByRole("navigation", { name: "IPO list pages" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Sort IPOs" }));
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Price · high to low" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/ipos/catalog?page=1&page_size=10&sort=price_desc",
        expect.anything(),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Open", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Closed", exact: true }));
    expect(screen.getByRole("button", { name: "Open", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/ipos/catalog?page=1&page_size=10&sort=price_desc&status=OPEN&status=CLOSED",
        expect.anything(),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Search company or exact symbol" }), {
      target: { value: "Catalog" },
    });
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/ipos/catalog?page=1&page_size=10&sort=price_desc&search=Catalog&status=OPEN&status=CLOSED",
        expect.anything(),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });

  it("keeps the catalog page focused without calendar navigation", async () => {
    apiRequestMock.mockResolvedValue(listResponse());
    renderPage();
    expect(await screen.findByRole("heading", { name: "IPO catalog" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /calendar/i })).not.toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/ipos/catalog?page=1&page_size=10&sort=date_desc",
      expect.anything(),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("shows shared category rules and prepares the IPO for application tracking", async () => {
    const personalIpoId = "99999999-9999-4999-8999-999999999999";
    const readyCatalogIpo = {
      ...catalogIpo,
      symbol: "CATALOG",
      exchange: "NSE",
      issue_price_min: "100",
      issue_price_max: "110",
      lot_size: 10,
      issue_size: "100000",
      opening_date: "2026-11-01",
      closing_date: "2026-11-03",
    };
    apiRequestMock.mockImplementation(async (path: string, _session, init?: RequestInit) => {
      if (path === `/api/ipos/catalog/${readyCatalogIpo.id}`) return { data: readyCatalogIpo };
      if (path === `/api/ipos/catalog/${readyCatalogIpo.id}/categories`) {
        return {
          data: {
            configurations: [{ id: "shared-retail-rule", category: "RETAIL", rule_version: 2 }],
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
      if (path === "/api/ipos?page=1&page_size=100&source=personal") {
        return {
          data: {
            ipos: [],
            pagination: { page: 1, page_size: 100, total: 0, total_pages: 1 },
          },
        };
      }
      if (path === `/api/ipos/catalog/${readyCatalogIpo.id}/import` && init?.method === "POST") {
        return { data: { ...readyCatalogIpo, id: personalIpoId } };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderPage(`/ipos/catalog/${readyCatalogIpo.id}`);
    expect(
      await screen.findByRole("heading", { name: readyCatalogIpo.company_name }),
    ).toBeInTheDocument();
    expect(screen.getByText("Admin-managed", { exact: true })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Application categories" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Demat account applications" })).toHaveAttribute(
      "href",
      `/ipos/catalog/${readyCatalogIpo.id}/applications`,
    );
    expect(screen.getByRole("link", { name: "Demat account applications" })).not.toHaveAttribute(
      "target",
    );
    expect(screen.queryByText("IPO Guru", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit IPO" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Configure categories" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use for application" })).not.toBeInTheDocument();
  });

  it("lists catalog-IPO accounts with their category and applied state", async () => {
    const accountId = "66666666-6666-4666-8666-666666666666";
    const otherAccountId = "77777777-7777-4777-8777-777777777777";
    const personalIpoId = "99999999-9999-4999-8999-999999999999";
    const readyCatalogIpo = {
      ...catalogIpo,
      symbol: "CATALOG",
      exchange: "NSE",
      issue_price_min: "100",
      issue_price_max: "110",
      lot_size: 10,
      issue_size: "100000",
      opening_date: "2026-11-01",
      closing_date: "2026-11-03",
    };
    apiRequestMock.mockImplementation(async (path: string, _session, init?: RequestInit) => {
      if (path === `/api/ipos/catalog/${readyCatalogIpo.id}`) return { data: readyCatalogIpo };
      if (path === `/api/ipos/catalog/${readyCatalogIpo.id}/categories`) {
        return { data: { configurations: [] } };
      }
      if (path.startsWith("/api/accounts?")) {
        const allAccounts = [
          {
            id: accountId,
            holder_name: "Applied Holder",
            account_status: "active",
            archived_at: null,
          },
          ...Array.from({ length: 24 }, (_, index) => ({
            id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}`,
            holder_name: `Other Holder ${index + 1}`,
            account_status: "active",
            archived_at: null,
          })),
          {
            id: otherAccountId,
            holder_name: "Ready Holder",
            account_status: "active",
            archived_at: null,
          },
        ];
        const accountSearch = new URLSearchParams(path.split("?")[1]).get("holder_name");
        const matchedAccounts = accountSearch
          ? allAccounts.filter((account) =>
              account.holder_name.toLocaleLowerCase().includes(accountSearch.toLocaleLowerCase()),
            )
          : allAccounts;
        const params = new URLSearchParams(path.split("?")[1]);
        const page = Number(params.get("page") ?? 1);
        const pageSize = Number(params.get("pageSize") ?? 10);
        return {
          data: {
            accounts: matchedAccounts.slice((page - 1) * pageSize, page * pageSize),
            pagination: {
              page,
              pageSize,
              total: matchedAccounts.length,
              totalPages: Math.ceil(matchedAccounts.length / pageSize),
            },
          },
        };
      }
      if (path === "/api/ipos?page=1&page_size=100&source=personal") {
        return {
          data: {
            ipos: [
              { ...readyCatalogIpo, id: personalIpoId, source_catalog_id: readyCatalogIpo.id },
            ],
            pagination: { page: 1, page_size: 100, total: 1, total_pages: 1 },
          },
        };
      }
      if (path === `/api/applications?ipo_id=${personalIpoId}&page=1&page_size=100`) {
        return {
          data: {
            applications: [
              {
                id: "55555555-5555-4555-8555-555555555555",
                demat_account_id: accountId,
                category_code: "RETAIL",
                application_status: "DRAFT",
                lots: 2,
                total_shares: 20,
                application_amount: "2100.00",
                calculation_snapshot: {
                  calculation_input: { price: "105.00", price_type: "BID" },
                },
              },
            ],
            pagination: { page: 1, page_size: 100, total: 1, total_pages: 1 },
          },
        };
      }
      if (path === `/api/ipos/catalog/${readyCatalogIpo.id}/import` && init?.method === "POST") {
        return { data: { ...readyCatalogIpo, id: personalIpoId } };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderPage(`/ipos/catalog/${readyCatalogIpo.id}/applications`);

    expect(
      await screen.findByRole("heading", { name: "Demat account applications" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("row", { name: /Applied Holder/ })).toHaveTextContent("Retail");
    expect(screen.getByRole("row", { name: /Applied Holder/ })).toHaveTextContent("Applied");
    const appliedRow = screen.getByRole("row", { name: /Applied Holder/ });
    expect(appliedRow).toHaveTextContent("2 × ₹105.00");
    expect(appliedRow).toHaveTextContent("₹2,100.00");
    expect(screen.getByRole("columnheader", { name: "Lots / price" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Total amount" })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Ready Holder/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Demat account application pages" }),
    ).toHaveTextContent("Page 1 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("row", { name: /Other Holder 10/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("row", { name: /Ready Holder/ })).toHaveTextContent(
      "Not Applied",
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search demat account applications" }), {
      target: { value: "Applied" },
    });
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        expect.stringContaining("holder_name=Applied"),
        expect.anything(),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(await screen.findByRole("row", { name: /Applied Holder/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("row", { name: /Ready Holder/ })).not.toBeInTheDocument(),
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search demat account applications" }), {
      target: { value: "Ready" },
    });
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        expect.stringContaining("holder_name=Ready"),
        expect.anything(),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(await screen.findByRole("row", { name: /Ready Holder/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("row", { name: /Applied Holder/ })).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("Application form")).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith(
      `/api/ipos/catalog/${readyCatalogIpo.id}/import`,
      expect.anything(),
      { method: "POST" },
    );
  });

  it("keeps application preparation unavailable until catalog issue data is complete", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === `/api/ipos/catalog/${catalogIpo.id}`) return { data: catalogIpo };
      if (path === `/api/ipos/catalog/${catalogIpo.id}/categories`) {
        return { data: { configurations: [] } };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderPage(`/ipos/catalog/${catalogIpo.id}/applications`);

    expect(screen.queryByRole("button", { name: "Use for application" })).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        "Demat account applications are available after the issue and bidding details are published.",
      ),
    ).toBeInTheDocument();
  });

  it("loads the admin editor for shared catalog category rules", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === `/api/ipos/catalog/${catalogIpo.id}`) return { data: catalogIpo };
      if (path === `/api/admin/ipos/catalog/${catalogIpo.id}/categories`) {
        return { data: { configurations: [] } };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderPage(`/admin/ipos/${catalogIpo.id}/categories`);

    expect(await screen.findByText("Category configuration")).toBeInTheDocument();
    expect(screen.getAllByText("RETAIL").length).toBeGreaterThan(0);
    expect(apiRequestMock).toHaveBeenCalledWith(
      `/api/admin/ipos/catalog/${catalogIpo.id}/categories`,
      expect.anything(),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("shows applications recorded for a personal IPO", async () => {
    const applicationId = "77777777-7777-4777-8777-777777777777";
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/accounts?")) {
        return {
          data: {
            accounts: [
              {
                id: "66666666-6666-4666-8666-666666666666",
                holder_name: "Test Holder",
                account_status: "active",
                archived_at: null,
              },
            ],
            pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
          },
        };
      }
      if (path.startsWith("/api/applications?")) {
        return {
          data: {
            applications: [
              {
                id: applicationId,
                ipo_id: catalogIpo.id,
                demat_account_id: "66666666-6666-4666-8666-666666666666",
                lots: 2,
                total_shares: 20,
                application_amount: "400.00",
                application_number: "APP-2026-001",
                submission_date: "2026-11-02T10:00:00.000Z",
                created_at: "2026-11-02T10:00:00.000Z",
                application_status: "SUBMITTED",
                demat_accounts: { holder_name: "Test Holder" },
                ipo_categories: { category: "RETAIL" },
                calculation_snapshot: {
                  calculation_input: { price: "200.00", price_type: "BID" },
                },
              },
            ],
            pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
          },
        };
      }
      if (path === `/api/ipos/${catalogIpo.id}/categories`) {
        return { data: { configurations: [] } };
      }
      return { data: { ...catalogIpo, exchange: "NSE", ipo_type: "MAINBOARD" } };
    });
    renderPage(`/ipos/${catalogIpo.id}`);
    expect(
      await screen.findByRole("heading", { name: "Demat account applications" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      `/applications/${applicationId}/edit?return_to=%2Fipos%2F${catalogIpo.id}`,
    );
    expect(screen.getByText("Test Holder")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /APP-2026-001/ })).toHaveTextContent("RETAIL");
    expect(screen.getByRole("row", { name: /APP-2026-001/ })).toHaveTextContent("₹200");
    expect(apiRequestMock).toHaveBeenCalledWith(
      `/api/applications?ipo_id=${catalogIpo.id}&page=1&page_size=10`,
      expect.anything(),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("lists an un-applied active demat account with an IPO-specific drawer link", async () => {
    const accountId = "66666666-6666-4666-8666-666666666666";
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/accounts?")) {
        return {
          data: {
            accounts: [
              {
                id: accountId,
                holder_name: "Ready Holder",
                account_status: "active",
                archived_at: null,
              },
            ],
            pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
          },
        };
      }
      if (path.startsWith("/api/applications?")) {
        return {
          data: {
            applications: [],
            pagination: { page: 1, page_size: 25, total: 0, total_pages: 1 },
          },
        };
      }
      if (path === `/api/ipos/${catalogIpo.id}/categories`) {
        return { data: { configurations: [] } };
      }
      return {
        data: {
          ...catalogIpo,
          exchange: "NSE",
          issue_price_min: "100",
          issue_price_max: "110",
          issue_size: "100000",
          lot_size: 10,
          opening_date: "2026-11-01",
          closing_date: "2026-11-03",
        },
      };
    });

    renderPage(`/ipos/${catalogIpo.id}`);

    expect(await screen.findByText("Ready Holder")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Ready Holder/ })).toHaveTextContent("Not applied");
    expect(screen.getByRole("link", { name: "Apply" })).toHaveAttribute(
      "href",
      `/applications/new?demat_account_id=${accountId}&ipo_id=${catalogIpo.id}&return_to=%2Fipos%2F${catalogIpo.id}`,
    );
  });

  it("shows a loading failure without incorrectly reporting an empty catalog", async () => {
    apiRequestMock.mockRejectedValue(new Error("Unavailable"));
    renderPage();
    expect(await screen.findAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText("No IPO records match these filters.")).not.toBeInTheDocument();
  });
});
