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
            configurations: [{ id: "copied-retail-rule", category: "RETAIL", rule_version: 1 }],
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

  it("explains how to add the first personal IPO when no options are returned", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
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

    const addIpoLink = await screen.findByRole("link", { name: "Add an IPO" });
    expect(addIpoLink).toHaveAttribute("href", "/ipos/new");
    expect(addIpoLink.parentElement).toHaveTextContent(
      "No personal IPOs are available. Add an IPO and configure its category before recording an application.",
    );
  });

  it("links to category setup when the selected IPO has no configured rules", async () => {
    const ipoId = "88888888-8888-4888-8888-888888888888";
    apiRequestMock.mockImplementation(async (path: string) => {
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
              { id: "first-rule", category: "RETAIL", rule_version: 1 },
              { id: "current-rule", category: "RETAIL", rule_version: 2 },
              { id: "hni-rule", category: "SHNI", rule_version: 1 },
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
});
