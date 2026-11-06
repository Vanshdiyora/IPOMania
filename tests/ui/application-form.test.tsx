// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type * as ApiModule from "../../apps/web/src/lib/api";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";
import { ApplicationFormPage } from "../../apps/web/src/pages/applications/ApplicationPages";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => ({ session: { access_token: "regular-user-token" } }),
}));
vi.mock("../../apps/web/src/components/ui/FormDrawer", () => ({
  RouteFormDrawer: ({
    children,
    disabled,
    submitLabel,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    submitLabel: string;
  }) => (
    <div>
      <button type="button" disabled={disabled}>
        {submitLabel}
      </button>
      {children}
    </div>
  ),
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
          <Routes>
            <Route path="/applications/new" element={<ApplicationFormPage />} />
            <Route
              path="/applications/:applicationId/edit"
              element={<ApplicationFormPage editing />}
            />
          </Routes>
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
  it("does not report the edited application as a duplicate and loads its IPO beyond the first page", async () => {
    const applicationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const ipoId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const accountId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const oldRuleId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const newRuleId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const rule = {
      category: "RETAIL",
      default_lots: 1,
      lot_limit_status: "NO_PUBLISHED_LIMIT",
      minimum_lots: 1,
      maximum_lots: null,
      lot_increment: 1,
      investment_limit_status: "NO_PUBLISHED_LIMIT",
      minimum_investment: null,
      maximum_investment: null,
      allowed_price_types: ["BID"],
    };
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/ipos?"))
        return { data: { ipos: [], pagination: { page: 1, total_pages: 1 } } };
      if (path === `/api/ipos/${ipoId}`)
        return {
          data: { id: ipoId, company_name: "Older IPO", lot_size: 1200, issue_price_max: "120" },
        };
      if (path === `/api/ipos/${ipoId}/categories`)
        return {
          data: {
            configurations: [
              { ...rule, id: oldRuleId, rule_version: 1 },
              { ...rule, id: newRuleId, rule_version: 2 },
            ],
          },
        };
      if (path.startsWith("/api/accounts?"))
        return {
          data: {
            accounts: [
              {
                id: accountId,
                holder_name: "Current holder",
                bank_name: "Current bank",
                username: "holder",
                account_status: "active",
                archived_at: null,
              },
            ],
            pagination: { page: 1, totalPages: 1 },
          },
        };
      if (path.startsWith("/api/applications?"))
        return {
          data: {
            applications: [
              {
                id: applicationId,
                ipo_id: ipoId,
                demat_account_id: accountId,
                archived_at: null,
                application_status: "DRAFT",
              },
            ],
            pagination: { page: 1, total_pages: 1 },
          },
        };
      if (path === `/api/applications/${applicationId}`)
        return {
          data: {
            id: applicationId,
            ipo_id: ipoId,
            demat_account_id: accountId,
            category_id: oldRuleId,
            category_code: "RETAIL",
            lots: 1,
            total_shares: 1200,
            application_amount: "144000",
            calculation_snapshot: { calculation_input: { price: "120" } },
          },
        };
      throw new Error(`Unexpected request: ${path}`);
    });

    const { container } = renderForm(`/applications/${applicationId}/edit`);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "IPO" })).toHaveTextContent("Older IPO"),
    );
    const category = container.querySelector<HTMLSelectElement>("select");
    await waitFor(() => expect(category).toHaveValue(oldRuleId));
    expect(category?.querySelector(`option[value="${oldRuleId}"]`)).toHaveTextContent(
      "Retail (recorded rule v1)",
    );
    expect(
      screen.queryByText(/An active application already exists for this IPO and demat account/),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save application" })).toBeEnabled(),
    );
  });

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
    expect(await screen.findByRole("option", { name: "Retail" })).toBeInTheDocument();
  });

  it("shows a preselected catalog-imported IPO in the issue selector", async () => {
    const ipoId = "99999999-9999-4999-8999-999999999999";
    const catalogIpoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/ipos/catalog?")) {
        return { data: { ipos: [], pagination: { page: 1, total_pages: 1 } } };
      }
      if (path.startsWith("/api/ipos?")) {
        return {
          data: {
            ipos: [
              {
                id: ipoId,
                source_catalog_id: catalogIpoId,
                company_name: "Preselected Imported IPO",
                status: "OPEN",
                issue_price_max: "66",
              },
            ],
            pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
          },
        };
      }
      if (path === `/api/ipos/${ipoId}`) {
        return {
          data: {
            id: ipoId,
            source_catalog_id: catalogIpoId,
            company_name: "Preselected Imported IPO",
            issue_price_max: "66",
          },
        };
      }
      if (path.startsWith("/api/accounts?")) {
        return {
          data: {
            accounts: [
              {
                id: "demat-account",
                holder_name: "IPO Test Holder",
                bank_name: "Test Bank",
                username: "test-user",
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
            pagination: { page: 1, page_size: 100, total: 0, total_pages: 1 },
          },
        };
      }
      if (path === `/api/ipos/${ipoId}/categories`) {
        return { data: { configurations: [] } };
      }
      throw new Error("Unexpected request: " + path);
    });

    renderForm(`/applications/new?ipo_id=${ipoId}&demat_account_id=demat-account`);

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "IPO" })).toHaveTextContent(
        "Preselected Imported IPO",
      ),
    );
    expect(screen.getByRole("combobox", { name: "Demat account" })).toHaveTextContent(
      "IPO Test Holder",
    );
    expect(screen.getByRole("textbox", { name: /Price/ })).toHaveValue("66");
  });

  it("allows saving an application when the same IPO is active on another account", async () => {
    const ipoId = "99999999-9999-4999-8999-999999999999";
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/ipos/catalog?")) {
        return { data: { ipos: [], pagination: { page: 1, total_pages: 1 } } };
      }
      if (path.startsWith("/api/ipos?")) {
        return {
          data: {
            ipos: [
              {
                id: ipoId,
                company_name: "Archived Application IPO",
                status: "OPEN",
                issue_price_max: "66",
                lot_size: 2000,
              },
            ],
            pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
          },
        };
      }
      if (path === `/api/ipos/${ipoId}`) {
        return {
          data: {
            id: ipoId,
            company_name: "Archived Application IPO",
            issue_price_max: "66",
            lot_size: 2000,
          },
        };
      }
      if (path.startsWith("/api/accounts?")) {
        return {
          data: {
            accounts: [
              {
                id: "demat-account",
                holder_name: "IPO Test Holder",
                bank_name: "Test Bank",
                username: "test-user",
                account_status: "active",
                archived_at: null,
              },
              {
                id: "another-demat-account",
                holder_name: "Other IPO Test Holder",
                bank_name: "Other Test Bank",
                username: "other-test-user",
                account_status: "active",
                archived_at: null,
              },
            ],
            pagination: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
          },
        };
      }
      if (path.startsWith("/api/applications?")) {
        return {
          data: {
            applications: [
              {
                id: "other-account-application",
                ipo_id: ipoId,
                demat_account_id: "another-demat-account",
                archived_at: null,
                application_status: "DRAFT",
              },
            ],
            pagination: { page: 1, page_size: 100, total: 1, total_pages: 1 },
          },
        };
      }
      if (path === `/api/ipos/${ipoId}/categories`) return { data: { configurations: [] } };
      throw new Error("Unexpected request: " + path);
    });

    const { container } = renderForm(
      `/applications/new?ipo_id=${ipoId}&demat_account_id=demat-account`,
    );

    const categorySelect = await screen.findByRole("combobox", { name: "Investor category" });
    await waitFor(() => expect(categorySelect).toBeEnabled());
    const nativeCategorySelect = container.querySelector("select");
    if (!nativeCategorySelect) throw new Error("The category selector was not rendered.");
    fireEvent.change(nativeCategorySelect, { target: { value: "RETAIL" } });

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Demat account" })).toHaveTextContent(
        "IPO Test Holder",
      ),
    );
    expect(categorySelect).toHaveTextContent("Retail");
    expect(screen.getByRole("spinbutton", { name: "Lots" })).toHaveValue(1);
    expect(screen.getByRole("textbox", { name: /Price/ })).toHaveValue("66");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save application" })).toBeEnabled(),
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Demat account" }));
    fireEvent.click(await screen.findByRole("option", { name: /Other IPO Test Holder/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save application" })).toBeDisabled(),
    );
    expect(
      screen.getByText(/An active application already exists for this IPO and demat account/),
    ).toBeInTheDocument();
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

    expect(
      await screen.findByText(
        "No IPOs are available in the catalog yet. Please check back after an administrator adds one.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add to catalog" })).not.toBeInTheDocument();
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
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
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

  it("allows category and lot selection when an IPO has no category rules", async () => {
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

    const categorySelect = screen.getByRole("combobox", { name: "Investor category" });
    await waitFor(() => expect(categorySelect).toBeEnabled());
    fireEvent.click(categorySelect);
    const options = ["Retail", "sHNI", "bHNI", "Shareholder"].map((name) =>
      screen.getByRole("option", { name }),
    );
    options.forEach((option) => expect(option).toBeEnabled());
    const shniOption = options[1];
    if (!shniOption) throw new Error("The sHNI category option was not rendered.");
    fireEvent.click(shniOption);

    const lots = screen.getByRole("spinbutton", { name: "Lots" });
    expect(lots).toBeEnabled();
    fireEvent.change(lots, { target: { value: "12" } });
    expect(lots).toHaveValue(12);
    expect(screen.queryByText(/category rules are configured/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/configure issue-specific rules/i)).not.toBeInTheDocument();
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
    expect(await screen.findByRole("option", { name: "Retail" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /rules v1|rules v2/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "sHNI" })).toBeInTheDocument();
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
