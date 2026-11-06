// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "../../apps/web/src/lib/api";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";
import {
  AccountDashboardPage,
  AccountListPage,
} from "../../apps/web/src/pages/accounts/AccountPages";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => ({
    session: { access_token: "regular-user-token" },
    markSessionExpired: vi.fn(),
  }),
}));

vi.mock("../../apps/web/src/components/ui/FormDrawer", () => ({
  DrawerRouteLink: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  RouteFormDrawer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../apps/web/src/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiRequest: apiRequestMock,
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ToastProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/accounts"]}>
          <Routes>
            <Route path="/accounts" element={<AccountListPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

function renderDashboardPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ToastProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/accounts"]}>
          <Routes>
            <Route path="/accounts" element={<AccountDashboardPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

describe("account list", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("requests dashboard totals from the separate summary endpoint", async () => {
    apiRequestMock.mockImplementation(async (path: string) =>
      path === "/api/accounts/summary"
        ? { data: { total: 0, active: 0, archived: 0 } }
        : {
            data: {
              accounts: [],
              pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
            },
          },
    );

    renderDashboardPage();

    await waitFor(() =>
      expect(apiRequestMock.mock.calls.some(([url]) => url === "/api/accounts/summary")).toBe(true),
    );
  });

  it("displays each saved password as text", async () => {
    apiRequestMock
      .mockResolvedValueOnce({
        data: {
          accounts: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              user_id: "22222222-2222-4222-8222-222222222222",
              holder_name: "Vansh",
              bank_name: "Axis",
              username: "vansh123",
              password_saved: true,
              account_status: "active",
              notes: null,
              created_at: "2026-11-02T00:00:00.000Z",
              updated_at: "2026-11-02T00:00:00.000Z",
              archived_at: null,
            },
          ],
          pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
        },
      })
      .mockResolvedValueOnce({ data: { password: "visible-bank-password" } });

    renderPage();

    const passwords = await screen.findAllByText("visible-bank-password");
    expect(passwords).toHaveLength(2);
    passwords.forEach((password) => expect(password).toBeVisible());
  });

  it("displays a dash for missing table values", async () => {
    apiRequestMock.mockResolvedValue({
      data: {
        accounts: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            user_id: "22222222-2222-4222-8222-222222222222",
            holder_name: "Vansh",
            bank_name: null,
            username: null,
            password_saved: false,
            account_status: "active",
            notes: null,
            created_at: "2026-11-02T00:00:00.000Z",
            updated_at: "2026-11-02T00:00:00.000Z",
            archived_at: null,
          },
        ],
        pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      },
    });

    renderPage();

    const row = await screen.findByRole("row", { name: /Vansh/ });
    const cells = within(row).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("-");
    expect(cells[2]).toHaveTextContent("-");
    expect(cells[3]).toHaveTextContent("-");
  });
});
