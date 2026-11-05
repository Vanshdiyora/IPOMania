// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppLayout } from "../../apps/web/src/components/layout/AppLayout";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";
import { AccountImportDialog } from "../../apps/web/src/pages/accounts/AccountPages";
import { Provider } from "react-redux";
import { createAppStore } from "../../apps/web/src/store";

vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => ({
    loading: false,
    session: { access_token: "regular-user-token" },
    user: { email: "investor@example.test" },
    markSessionExpired: vi.fn(),
  }),
}));

function renderDialog(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ToastProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AccountImportDialog onClose={onClose} />
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
  return onClose;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderAccountLayout(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <Provider store={createAppStore()}>
      <ToastProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route
                  path="/accounts"
                  element={
                    <>
                      <h1>Account dashboard</h1>
                      <LocationProbe />
                    </>
                  }
                />
                <Route
                  path="/accounts/import-history"
                  element={
                    <>
                      <h1>Import history</h1>
                      <LocationProbe />
                    </>
                  }
                />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ToastProvider>
    </Provider>,
  );
}

describe("account import dialog", () => {
  it("keeps the spreadsheet workflow inside an accessible dialog", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Bulk account import" })).toBeInTheDocument();
    expect(screen.getByLabelText("Choose a CSV or XLSX file")).toHaveAttribute(
      "accept",
      expect.stringContaining(".csv"),
    );
    expect(screen.getByRole("button", { name: "Upload and read columns" })).toBeDisabled();
  });

  it("closes with Escape", () => {
    const onClose = renderDialog();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([
    ["/accounts?accountImport=true", "Account dashboard", "/accounts"],
    ["/accounts/import-history?accountImport=true", "Import history", "/accounts/import-history"],
  ])(
    "opens over %s and dismisses without leaving the current page",
    async (path, heading, pathname) => {
      renderAccountLayout(path);

      expect(
        await screen.findByRole("dialog", { name: "Bulk account import" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();

      fireEvent.keyDown(document, { key: "Escape" });

      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", { name: "Bulk account import" }),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByTestId("location")).toHaveTextContent(pathname);
    },
  );
});
