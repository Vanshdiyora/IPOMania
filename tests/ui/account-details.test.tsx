// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type * as ApiModule from "../../apps/web/src/lib/api";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";
import { AccountDetailsPage } from "../../apps/web/src/pages/accounts/AccountPages";

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
        <MemoryRouter initialEntries={["/accounts/account-123"]}>
          <Routes>
            <Route path="/accounts/:accountId" element={<AccountDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

describe("account details", () => {
  it("presents the account identity, credentials, activity, and notes", async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: {
        id: "account-123",
        user_id: "user-123",
        holder_name: "Sahil Mehta",
        bank_name: "Axis Bank",
        username: "sahil.mehta",
        password_saved: false,
        account_status: "active",
        notes: "Primary account",
        created_at: "2026-11-02T00:00:00.000Z",
        updated_at: "2026-11-04T00:00:00.000Z",
        archived_at: null,
      },
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Account details" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Sahil Mehta" })).toBeVisible();
    expect(screen.getByText("Axis Bank")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Sign-in credentials" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Account activity" })).toBeVisible();
    expect(screen.getByText("sahil.mehta")).toBeVisible();
    expect(screen.getByText("Primary account")).toBeVisible();
    expect(screen.getByRole("link", { name: "Edit account" })).toHaveAttribute(
      "href",
      "/accounts/account-123/edit",
    );
  });
});
