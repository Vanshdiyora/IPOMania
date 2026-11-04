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
    const categorySelect = await screen.findByRole("combobox", { name: "Application category" });
    await waitFor(() => expect(categorySelect).not.toBeDisabled());
    fireEvent.click(categorySelect);
    expect(await screen.findByRole("option", { name: "Retail (rules v1)" })).toBeInTheDocument();
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

  it("lists shared catalog IPOs and imports the selected IPO for the user", async () => {
    const catalogIpoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const preparedIpoId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    apiRequestMock.mockImplementation(async (path: string, _session, init?: RequestInit) => {
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
            ipos: [{ id: catalogIpoId, company_name: "Shared Catalog IPO", status: "OPEN" }],
            pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
          },
        };
      }
      if (path === `/api/ipos/catalog/${catalogIpoId}/import` && init?.method === "POST") {
        return {
          data: {
            id: preparedIpoId,
            company_name: "Shared Catalog IPO",
            source_catalog_id: catalogIpoId,
            lot_size: 10,
          },
        };
      }
      if (path === `/api/ipos/${preparedIpoId}/categories`) {
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
        `/api/ipos/catalog/${catalogIpoId}/import`,
        expect.anything(),
        { method: "POST" },
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "IPO" })).toHaveTextContent("Shared Catalog IPO"),
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

    fireEvent.click(await screen.findByRole("combobox", { name: "Application category" }));
    expect(await screen.findByRole("option", { name: "Retail (rules v2)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Retail (rules v1)" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "sHNI (rules v1)" })).toBeInTheDocument();
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
